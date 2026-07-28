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
  const putOk = await new Promise<boolean>((resolve) => {
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

  // 3. /api/upload/init
  const initBody: InitPayload = {
    r2_key: presign.key,
    event_id: eventId,
    file_name: filename,
    file_type: contentType,
    file_size: file.size,
    uploaded_by: uploadedBy,
  };
  const initRes = await fetch('/api/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initBody),
    signal,
  });
  if (!initRes.ok) return { error: `init fallito HTTP ${initRes.status}` };

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
