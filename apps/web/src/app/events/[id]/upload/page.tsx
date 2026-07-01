'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { uploadToStorage, deleteFromStorage, createMediaRecord, updateDriveSyncStatus, getDriveToken, getEventDriveFolders, enqueueUpload, getPendingQueue, updateQueueItem, getQueueStats, compressImage, type QueueItem } from '@fotosposi/media';
import { getCurrentUser } from '@fotosposi/core';
import { getEventById, getEventWindow } from '@fotosposi/events';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://krgqyluuiltckmhbeuue.supabase.co';
const QUEUE_DELAY_MS = 2000;
const ADAPTIVE_DELAY = true;

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
  const processingRef = useRef(false);

  const loadQueue = useCallback(async () => {
    const { items } = await getPendingQueue(eventId);
    if (items) {
      setQueue(items);
      const s = await getQueueStats(eventId);
      setStats(s);
      if (items.some(i => i.status === 'pending' || i.status === 'failed')) {
        setPhase('processing');
      }
    }
  }, [eventId]);

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
      loadQueue();
    };
    init();
  }, [eventId, router, loadQueue]);

  const processItem = useCallback(async (item: QueueItem) => {
    await updateQueueItem(item.id, { status: 'processing' });
    setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));

    const [{ token }, { folders }] = await Promise.all([
      getDriveToken(eventId),
      getEventDriveFolders(eventId),
    ]);
    const hasDrive = !!token?.access_token;

    try {
      const isVideo = item.file_type.startsWith('video/');
      const ext = isVideo ? (item.file_name.split('.').pop() || 'mp4') : 'jpg';
      const ts = Date.now();
      const origPath = `${eventId}/orig_q_${item.id}_${ts}.${ext}`;
      const thumbPath = `${eventId}/thumb_q_${item.id}_${ts}.${ext}`;

      const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/queue_buffer/${item.id}`;
      const resp = await fetch(fileUrl);
      if (!resp.ok) throw new Error('File temporaneo non trovato');
      const fileBlob = await resp.blob();
      const file = new File([fileBlob], item.file_name, { type: item.file_type });

      const { url: origUrl, error: origError } = await uploadToStorage('media', origPath, file);
      if (origError || !origUrl) throw new Error(origError || 'Upload su storage fallito');

      const compressed = isVideo ? file : await compressImage(file);
      await uploadToStorage('media', thumbPath, compressed);

      const { media, error: recordError } = await createMediaRecord({
        event_id: eventId,
        uploaded_by: item.uploaded_by,
        type: isVideo ? 'video' : 'photo',
        url: thumbPath,
      });
      if (recordError || !media) throw new Error(recordError || 'Record media non creato');

      await updateQueueItem(item.id, { storage_path: origPath, compressed_path: thumbPath });

      if (hasDrive && folders) {
        try {
          const driveFolderId = isVideo ? (folders['Video'] || folders['root']) : (folders['Foto'] || folders['root']);

          const fileRes = await fetch(origUrl);
          const origBlob = await fileRes.blob();
          if (origBlob.size < 1024) throw new Error('File corrotto');
          const formData = new FormData();
          formData.append('file', origBlob, item.file_name);
          const metadata: Record<string, unknown> = { name: item.file_name };
          if (driveFolderId) metadata.parents = [driveFolderId];
          formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

          const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2Csize', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token.access_token}` },
            body: formData,
          });
          const driveData = await driveRes.json();
          if (driveRes.ok && driveData.id) {
            await updateDriveSyncStatus(media.id, 'synced', driveData.id);
            await deleteFromStorage('media', origPath);
            await updateQueueItem(item.id, { status: 'synced', drive_file_id: driveData.id, processed_at: new Date().toISOString() });
          } else {
            await updateDriveSyncStatus(media.id, 'failed');
            await updateQueueItem(item.id, { status: 'synced', error: 'Drive sync fallito' });
          }
        } catch {
          await updateDriveSyncStatus(media.id, 'failed');
          await updateQueueItem(item.id, { status: 'synced', error: 'Drive sync fallito' });
        }
      } else {
        await updateQueueItem(item.id, { status: 'synced', processed_at: new Date().toISOString() });
      }

      await deleteFromStorage('queue_buffer', item.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore';
      await updateQueueItem(item.id, { status: 'failed', error: msg, retry_count: item.retry_count + 1 });
    }

    const s = await getQueueStats(eventId);
    setStats(s);
    setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: s.synced > 0 ? 'synced' : 'failed' } : i));
  }, [eventId]);

  const processQueueLoop = useCallback(async () => {
    if (pausedRef.current || processingRef.current) return;
    processingRef.current = true;

    const { items } = await getPendingQueue(eventId);
    const next = items?.find(i => i.status === 'pending' || i.status === 'failed');
    if (!next) {
      const s = await getQueueStats(eventId);
      setStats(s);
      setPhase(s.pending + s.processing > 0 ? 'processing' : 'idle');
      processingRef.current = false;
      return;
    }

    await processItem(next);
    processingRef.current = false;

    if (!pausedRef.current) {
      const remaining = (await getPendingQueue(eventId)).items?.filter(i => i.status === 'pending' || i.status === 'failed') || [];
      if (remaining.length > 0) {
        const delay = ADAPTIVE_DELAY && next.file_size > 50 * 1024 * 1024 ? QUEUE_DELAY_MS * 2 : QUEUE_DELAY_MS;
        setTimeout(() => processQueueLoop(), delay);
      } else {
        setPhase('idle');
      }
    }
  }, [eventId, processItem]);

  useEffect(() => {
    if (phase === 'processing' && !paused && !pausedRef.current && !processingRef.current) {
      processQueueLoop();
    }
  }, [phase, paused, processQueueLoop]);

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

      const { error: uploadError } = await uploadToStorage('queue_buffer', id, file);
      if (uploadError) {
        await updateQueueItem(id, { status: 'failed', error: uploadError });
        continue;
      }

      queued++;
      setQueue(prev => [...prev, {
        id, event_id: eventId, uploaded_by: user.id,
        file_name: file.name, file_type: file.type, file_size: file.size,
        status: 'pending' as const,
        storage_path: null, compressed_path: null, drive_file_id: null,
        error: null, retry_count: 0, created_at: new Date().toISOString(), processed_at: null,
      }]);
    }

    setStats(prev => ({ ...prev, pending: prev.pending + queued }));
    setPhase('processing');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handlePause = () => {
    pausedRef.current = true;
    setPaused(true);
  };

  const handleResume = () => {
    pausedRef.current = false;
    setPaused(false);
    if (phase === 'processing') processQueueLoop();
    else setPhase('processing');
  };

  if (!eventReady) return <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}><p>Caricamento...</p></main>;

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Carica foto e video</h1>
      <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
        Seleziona tutti i file che vuoi. Verranno accodati ed elaborati uno alla volta.
        Puoi chiudere la pagina e tornare più tardi — i file non andranno persi.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          onChange={handleSelectFiles}
          disabled={phase === 'queueing' || (phase === 'processing' && !paused)}
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

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {(phase === 'processing' || paused) && queue.some(i => i.status === 'pending' || i.status === 'failed') && (
          paused
            ? <button onClick={handleResume} style={{ padding: '0.5rem 1.5rem', cursor: 'pointer' }}>Riprendi</button>
            : <button onClick={handlePause} style={{ padding: '0.5rem 1.5rem', cursor: 'pointer' }}>Metti in pausa</button>
        )}
      </div>

      {paused && (
        <p style={{ marginTop: '0.5rem', color: '#f90', fontSize: '0.9rem' }}>
          ⏸ In pausa. I file rimanenti sono al sicuro nella coda: torna quando vuoi e premi "Riprendi".
        </p>
      )}

      {phase === 'processing' && !paused && queue.some(i => i.status === 'processing') && (
        <p style={{ marginTop: '0.5rem', color: '#555', fontSize: '0.9rem' }}>
          Elaborazione in corso... un file ogni {QUEUE_DELAY_MS / 1000} secondi per non sovraccaricare.{' '}
          {ADAPTIVE_DELAY && 'I file più grandi vengono elaborati più lentamente.'}
        </p>
      )}

      {phase === 'idle' && stats.synced > 0 && (
        <p style={{ marginTop: '0.5rem', color: '#090', fontSize: '0.9rem' }}>
          Tutti i file sono stati elaborati! {stats.synced} completati{stats.failed > 0 ? `, ${stats.failed} con errori. Premi "Riprendi" per riprovare.` : '.'}
        </p>
      )}

      <p style={{ marginTop: '1.5rem' }}>
        <a href={`/events/${eventId}`} style={{ color: '#d4a574' }}>← Torna all'evento</a>
      </p>
    </main>
  );
}
