'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createMediaRecord, enqueueUpload, getPendingQueue, updateQueueItem, getQueueStats, type QueueItem } from '@fotosposi/media';
import { getCurrentUser } from '@fotosposi/core';
import { getEventById, getEventWindow } from '@fotosposi/events';

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [phase, setPhase] = useState<'idle' | 'queueing' | 'processing'>('idle');
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ pending: 0, processing: 0, synced: 0, failed: 0 });
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [eventReady, setEventReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pausedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const loadQueue = useCallback(async () => {
    const { items } = await getPendingQueue(eventId);
    if (items) {
      setQueue(items);
      const s = await getQueueStats(eventId);
      setStats(s);
      if (items.some(i => i.status === 'pending' || i.status === 'failed')) {
        setPhase('processing');
        return true;
      }
      if (s.synced + s.failed === s.pending + s.processing + s.synced + s.failed && s.synced + s.failed > 0) {
        setPhase('idle');
      }
    }
    return false;
  }, [eventId]);

  const triggerServerProcessing = async () => {
    await fetch('/api/r2/process-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
  };

  useEffect(() => {
    const init = async () => {
      const { user } = await getCurrentUser();
      if (!user) { router.push('/login'); return; }
      const { event } = await getEventById(eventId);
      if (!event) return;
      const isCreator = event.created_by === user.id;
      if (!isCreator) {
        const { window: w } = await getEventWindow(eventId);
        if (w) {
          const now = new Date();
          if (now < new Date(w.opens_at) || now > new Date(w.closes_at)) {
            router.push(`/events/${eventId}`);
            return;
          }
        }
      }
      setEventReady(true);
      const hasPending = await loadQueue();
      if (hasPending) {
        triggerServerProcessing();
        pollRef.current = setInterval(async () => {
          const stillPending = await loadQueue();
          if (!stillPending) {
            clearInterval(pollRef.current);
          }
        }, 3000);
      }
    };
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [eventId, router, loadQueue]);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const stillPending = await loadQueue();
      if (!stillPending) {
        clearInterval(pollRef.current);
        pollRef.current = undefined;
      }
    }, 3000);
  };

  const handleSelectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;

    const { user } = await getCurrentUser();
    if (!user) return;

    setPhase('queueing');
    setQueueProgress({ current: 0, total: selected.length });
    let queued = 0;

    for (let i = 0; i < selected.length; i++) {
      const file = selected.item(i);
      if (!file) continue;
      setQueueProgress({ current: i + 1, total: selected.length });

      const { id, error } = await enqueueUpload({
        event_id: eventId,
        uploaded_by: user.id,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
      });
      if (error || !id) continue;

      const prefix = `events/${eventId}`;
      const r2Resp = await fetch('/api/r2/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, prefix }),
      });
      const r2Data = await r2Resp.json();
      if (!r2Resp.ok || !r2Data.presignedUrl) {
        await updateQueueItem(id, { status: 'failed', error: r2Data.error || 'Presigned URL fallita' });
        continue;
      }

      const uploadResp = await fetch(r2Data.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadResp.ok) {
        await updateQueueItem(id, { status: 'failed', error: 'Upload R2 fallito' });
        continue;
      }

      await updateQueueItem(id, { r2_key: r2Data.key });

      queued++;
      setQueue(prev => [...prev, {
        id, event_id: eventId, uploaded_by: user.id,
        file_name: file.name, file_type: file.type, file_size: file.size,
        status: 'pending' as const,
        storage_path: null, compressed_path: null, drive_file_id: null,
        error: null, retry_count: 0, created_at: new Date().toISOString(), processed_at: null, r2_key: r2Data.key,
      }]);
    }

    setStats(prev => ({ ...prev, pending: prev.pending + queued }));
    setPhase('processing');
    if (inputRef.current) inputRef.current.value = '';

    triggerServerProcessing();
    startPolling();
  };

  if (!eventReady) return <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}><p>Caricamento...</p></main>;

  const allDone = phase === 'idle' && (stats.synced + stats.failed) > 0 && stats.pending + stats.processing === 0;

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Carica foto e video</h1>
      <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
        Seleziona tutti i file che vuoi. L'elaborazione continua anche se chiudi la pagina.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleSelectFiles}
          disabled={phase === 'queueing' || phase === 'processing'}
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </div>

      {phase === 'queueing' && (
        <p style={{ marginBottom: '1rem', color: '#555', fontSize: '0.9rem' }}>
          Accodamento file in corso... {queueProgress.current}/{queueProgress.total}
        </p>
      )}

      {(stats.synced + stats.failed + stats.pending + stats.processing > 0) && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <span style={{ color: '#090' }}>✔ {stats.synced} completati</span>
          <span style={{ color: '#c00' }}>✘ {stats.failed} falliti</span>
          <span style={{ color: '#888' }}>⏳ {stats.pending + stats.processing} in coda</span>
        </div>
      )}

      {queue.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#444' }}>Coda file</h3>
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 6, padding: '0.5rem' }}>
            {queue.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', fontSize: '0.85rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: item.status === 'synced' ? '#090' : item.status === 'failed' ? '#c00' : item.status === 'processing' ? '#f90' : '#ccc' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file_name}</span>
                <span style={{ color: '#888', flexShrink: 0 }}>{(item.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                <span style={{ color: item.status === 'failed' ? '#c00' : '#666', flexShrink: 0, fontSize: '0.8rem' }}>
                  {item.status === 'synced' ? 'Fatto' : item.status === 'processing' ? 'In corso...' : item.status === 'failed' ? `Fallito${item.error ? ': ' + item.error : ''}` : 'In attesa'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'processing' && (
        <p style={{ marginTop: '0.5rem', color: '#555', fontSize: '0.9rem' }}>
          Elaborazione lato server in corso... puoi chiudere la pagina e tornare dopo.
        </p>
      )}

      {allDone && (
        <p style={{ marginTop: '0.5rem', color: '#090', fontSize: '0.9rem' }}>
          Tutti i file sono stati elaborati! {stats.synced} completati{stats.failed > 0 ? `, ${stats.failed} con errori.` : '.'}
        </p>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <a href={`/events/${eventId}`} style={{ color: '#d4a574' }}>← Torna all'evento</a>
      </p>
    </main>
  );
}
