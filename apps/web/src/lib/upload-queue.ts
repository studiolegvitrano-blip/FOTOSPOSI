'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Hook + helper per upload resiliente (pattern Immich):
 *  - Mantiene una coda persistente dei file in attesa anche se il tab si chiude.
 *  - Se il browser supporta Service Worker + Background Sync API: passa il Blob al
 *    SW via postMessage, il SW mette in IndexedDB e tenta l'upload anche con tab chiuso.
 *  - Se NON supportato (es. iOS Safari): salviamo in IndexedDB locale e ritentiamo
 *    su 'online' event o quando l'utente ritorna sulla pagina (visibilitychange).
 *
 * Il client fa SEMPRE il primo tentativo "live" (più veloce). Il SW è solo fallback.
 */

export type UploadItemStatus = 'pending' | 'uploading' | 'done' | 'failed';

export type UploadItem = {
  /** Identificativo univoco locale (NON UUID globale: solo per UI). */
  localId: string;
  filename: string;
  size: number;
  progress: number;
  status: UploadItemStatus;
  error?: string;
};

type PresignResponse = {
  presignedUrl: string;
  key: string;
  error?: string;
};

type InitPayload = {
  r2_key: string;
  event_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
};

// ─────────────────────────────────────────────────────────────────────
// Backoff esponenziale: riusato anche dal SW inline in /public/sw.js
// (non può importare da qui — Service Worker standalone file). Stessi
// numeri per coerenza lato client/SW.
// ─────────────────────────────────────────────────────────────────────
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_CAP_MS = 60000;
export const BACKOFF_MAX_RETRIES = 5; // max tentativi client (SW ne fa di più)

/**
 * Calcola il prossimo delay di retry in ms con backoff esponenziale + jitter.
 * Sequenza (senza jitter): 1s → 2s → 4s → 8s → 16s → 32s → 60s (cap).
 * + jitter 0..BACKOFF_BASE_MS per evitare thundering herd su riconnessioni
 * di molti client simultaneamente (es. WiFi venue che torna dopo 5 min down).
 */
export function computeBackoffMs(retryCount: number): number {
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * Math.pow(2, Math.max(0, retryCount - 1)));
  const jitter = Math.floor(Math.random() * BACKOFF_BASE_MS);
  return exp + jitter;
}

/**
 * Sleep cancellabile via AbortSignal: ritorna Promise che si risolve dopo `ms`
 * o si rigetta con 'AbortError' se il signal triggera prima.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('AbortError')); }, { once: true });
  });
}

/**
 * Esegue un singolo upload:
 *  1. Chiede presigned URL a /api/r2/upload
 *  2. PUT del blob su R2 (con onProgress via XHR per progressbar)
 *  3. POST /api/upload/init per registrare upload_queue
 *
 * Su errore di rete, ritenta con backoff esponenziale (max 5 tentativi).
 * Se dopo i retry il blob è ancora lì e la connessione è morta → push al SW
 * per background retry (best-effort).
 */
export async function uploadSingleFile(
  file: File | Blob,
  meta: { eventId: string; filename: string; contentType: string; uploadedBy: string },
  options: {
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<{ r2_key?: string; error?: string }> {
  const { eventId, filename, contentType, uploadedBy } = meta;
  const { onProgress, signal } = options;

  // 1. presign
  const presignRes = await fetch('/api/r2/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType, prefix: `events/${eventId}`, fileSize: file.size }),
    signal,
  });
  if (!presignRes.ok) return { error: `presign fallita HTTP ${presignRes.status}` };
  const presign: PresignResponse = await presignRes.json();
  if (!presign.presignedUrl || !presign.key) return { error: presign.error || 'presign senza URL' };

  // 2. PUT su R2 con XHR per progress (fetch() non supporta progress events nativi).
  //    Wrappato in retry con backoff esponenziale: la rete WiFi venue spesso è
  //    ballerina (150 persone connesse, interferenze, roaming passeggero).
  let putOk = false;
  for (let attempt = 1; attempt <= BACKOFF_MAX_RETRIES && !putOk; attempt++) {
    putOk = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presign.presignedUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 90));
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.onabort = () => resolve(false);
      if (signal) {
        const onAbort = () => { xhr.abort(); resolve(false); };
        if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
      }
      xhr.send(file);
    });
    if (!putOk && attempt < BACKOFF_MAX_RETRIES) {
      // Backoff prima del prossimo tentativo (salta l'ultimo per non attendere invano).
      try { await sleep(computeBackoffMs(attempt), signal); }
      catch { return { error: 'Upload interrotto' }; }
    }
  }
  if (!putOk) {
    // Best-effort: prova a passare al SW per background retry.
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.active?.postMessage({
          type: 'queue-upload',
          presignedUrl: presign.presignedUrl,
          r2Key: presign.key,
          eventId,
          filename,
          contentType,
          uploadedBy,
          blob: file,
        });
      }
    } catch (_) { /* SW non disponibile o errore postMessage: ok, file sarà perso, l'utente riprova */ }
    return { error: 'Upload interrotto, riprovare' };
  }
  onProgress?.(95);

  // 3. /api/upload/init — anche qui retry con backoff (più raro fallire, ma
  //    se la lambda Vercel è in cold start il primo POST può timeoutare).
  let initOk = false;
  let initLastError = '';
  for (let attempt = 1; attempt <= BACKOFF_MAX_RETRIES && !initOk; attempt++) {
    const initBody: InitPayload = {
      r2_key: presign.key,
      event_id: eventId,
      file_name: filename,
      file_type: contentType,
      file_size: file.size,
      uploaded_by: uploadedBy,
    };
    try {
      const initRes = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initBody),
        signal,
      });
      if (initRes.ok) { initOk = true; break; }
      initLastError = `init fallito HTTP ${initRes.status}`;
    } catch (e) {
      initLastError = e instanceof Error ? e.message : 'errore rete';
    }
    if (attempt < BACKOFF_MAX_RETRIES) {
      try { await sleep(computeBackoffMs(attempt), signal); }
      catch { return { error: 'Upload interrotto' }; }
    }
  }
  if (!initOk) return { error: initLastError || 'init fallito' };

  onProgress?.(100);
  return { r2_key: presign.key };
}

/**
 * Hook di utilità: rileva cambiamenti di connettività e ritenta la coda SW
 * se torniamo online.
 */
export function useUploadResilience() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const requestBackgroundFlush = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: 'flush-now' });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const onOnline = () => { setOnline(true); requestBackgroundFlush(); };
    const onOffline = () => setOnline(false);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') requestBackgroundFlush();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [requestBackgroundFlush]);

  return { online, requestBackgroundFlush };
}
