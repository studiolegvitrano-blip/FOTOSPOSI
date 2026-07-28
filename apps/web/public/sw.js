/**
 * Service Worker per Sposi.live / JustMarry.live
 *
 * Reference architetturale: Immich (https://github.com/immich-app/immich) — usano un SW
 * con Background Sync API + IndexedDB per garantire upload completi anche se l'utente
 * chiude il tab. Qui replichiamo lo stesso pattern con i limiti del browser:
 *  - Background Sync API SOLO se il sito è installato come PWA (manifest+SW attivo).
 *  - iOS Safari NON supporta Background Sync API: la nostra fallback strategy è
 *    "queue IndexedDB + retry on online + retry on visibility change".
 *
 * Flusso upload resiliente:
 *   1. UploadPage: l'utente seleziona N foto → per ogni file crea un record IndexedDB
 *      con { blob, filename, contentType, eventId } → invia un POST al SW via
 *      postMessage per metterlo in coda "background".
 *   2. SW riceve messaggio → se online fa fetch PUT al presigned URL di R2 (segnalato
 *      dall'indexedDB record) → al successo POST /api/upload/init per registrare
 *      upload_queue e rimuove il record da IndexedDB.
 *   3. SW emette "sync" event (Background Sync API) → se il tab è stato chiuso,
 *      Chrome/Edge ritentano l'upload appena c'è connettività.
 *   4. SW ascolta "online" event + "periodicsync" (se disponibile) per retry ulteriore.
 *
 * File: apps/web/public/sw.js (servito da /sw.js)
 */

// Cache versioning: bumpare per forzare re-install.
const CACHE_NAME = 'spositive-v2';
const OFFLINE_URL = '/offline.html';
const UPLOAD_DB_NAME = 'fotosposi-upload-queue';
const UPLOAD_DB_VERSION = 1;
const UPLOAD_STORE = 'pending';
const SYNC_TAG = 'fotosposi-upload';

/* ──────────────────────────────────────────────────────────────────────────
 * Lifecycle
 * ────────────────────────────────────────────────────────────────────────── */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

/* ──────────────────────────────────────────────────────────────────────────
 * Fetch handler (cache-first per assets statici, network-first per API)
 * ────────────────────────────────────────────────────────────────────────── */

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Non intercettare upload PUT (vengono gestiti dal background sync handler)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase') || url.hostname.includes('r2.cloudflarestorage')) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, clone));
    }
    return res;
  } catch {
    return caches.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((c) => c.put(req, clone));
    }
    return res;
  } catch {
    return caches.match(req) || caches.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Background upload queue (IndexedDB + Background Sync API)
 * ────────────────────────────────────────────────────────────────────────── */

function openUploadDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(UPLOAD_DB_NAME, UPLOAD_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(UPLOAD_STORE)) {
        db.createObjectStore(UPLOAD_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putUploadRecord(record) {
  const db = await openUploadDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(UPLOAD_STORE, 'readwrite');
    const store = tx.objectStore(UPLOAD_STORE);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllPending() {
  const db = await openUploadDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(UPLOAD_STORE, 'readonly');
    const store = tx.objectStore(UPLOAD_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteUploadRecord(id) {
  const db = await openUploadDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(UPLOAD_STORE, 'readwrite');
    const store = tx.objectStore(UPLOAD_STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Tenta di caricare un singolo file pendente su R2 via presigned URL.
 * Se riesce, POSTa /api/upload/init per registrare upload_queue e rimuove
 * il record da IndexedDB. Se fallisce, lascia il record per un retry futuro.
 */
async function flushOne(record) {
  try {
    // 1) PUT del blob su R2 (presigned URL era stato pre-calcolato dal client prima
    //    di mettere in coda; lo memorizziamo nel record IndexedDB insieme al blob).
    const putRes = await fetch(record.presignedUrl, {
      method: 'PUT',
      body: record.blob,
      headers: { 'Content-Type': record.contentType },
    });
    if (!putRes.ok) throw new Error(`PUT R2 fallito HTTP ${putRes.status}`);

    // 2) Comunica al server che l'upload è avvenuto (registra upload_queue).
    const initRes = await fetch('/api/upload/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        r2_key: record.r2Key,
        event_id: record.eventId,
        file_name: record.filename,
        file_type: record.contentType,
        file_size: record.blob.size,
        uploaded_by: record.uploadedBy,
      }),
    });
    if (!initRes.ok) throw new Error(`/api/upload/init HTTP ${initRes.status}`);

    // 3) Tutto ok: rimuovi dalla coda locale.
    await deleteUploadRecord(record.id);
    return { ok: true, id: record.id };
  } catch (err) {
    console.warn('[sw] flush fallito per record', record.id, err);
    return { ok: false, id: record.id, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Scarica e tenta di caricare tutti i record pendenti. Chiamato su:
 *  - "online" event
 *  - "sync" event (Background Sync API)
 *  - messaggio "flush" dal client
 */
async function flushAll() {
  const pending = await getAllPending();
  const results = [];
  for (const record of pending) {
    results.push(await flushOne(record));
  }
  // Notifica tutti i client (se ce ne sono aperti) con l'esito.
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({
    type: 'upload-flushed',
    results,
    remaining: (await getAllPending()).length,
  }));
  return results;
}

// Background Sync API (Chrome/Edge/Android). Su iOS Safari non esiste.
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushAll());
  }
});

// Periodic Sync (Chrome desktop). Permette retry periodici anche con tab chiuso.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushAll());
  }
});

// Online: ritenta subito.
self.addEventListener('online', () => { flushAll(); });

/* ──────────────────────────────────────────────────────────────────────────
 * Client ↔ SW messaging
 * ────────────────────────────────────────────────────────────────────────── */

self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  switch (data.type) {
    case 'queue-upload': {
      // Client ha generato presigned URL e vuole che il SW lo carichi anche se il
      // tab viene chiuso prima del fetch().
      const id = await putUploadRecord({
        presignedUrl: data.presignedUrl,
        r2Key: data.r2Key,
        eventId: data.eventId,
        filename: data.filename,
        contentType: data.contentType,
        uploadedBy: data.uploadedBy,
        blob: data.blob, // Blob serializzabile via postMessage con struttura clonate
        queuedAt: Date.now(),
      });
      // Prova subito. Se va bene ok, altrimenti registra sync per retry.
      const result = await flushOne(await getAllPending().then((arr) => arr.find((r) => r.id === id)));
      // Richiedi sync per retry futuri (idempotente: Chrome lo gestisce come "uno scheduled")
      if ('sync' in self.registration) {
        try { await self.registration.sync.register(SYNC_TAG); } catch (_) { /* iOS Safari no-op */ }
      }
      if (event.source && 'postMessage' in event.source) {
        event.source.postMessage({ type: 'queue-upload-result', id, ok: result.ok, error: result.error });
      }
      break;
    }

    case 'flush-now': {
      // Client chiede di ritentare subito la coda (es. su reconnect manuale).
      const results = await flushAll();
      if (event.source && 'postMessage' in event.source) {
        event.source.postMessage({ type: 'flush-now-result', results });
      }
      break;
    }

    case 'skip-waiting': {
      self.skipWaiting();
      break;
    }
  }
});
