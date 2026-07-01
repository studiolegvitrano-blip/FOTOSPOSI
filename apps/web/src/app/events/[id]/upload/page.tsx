'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { compressImage, uploadToStorage, createMediaRecord } from '@fotosposi/media';
import { getCurrentUser } from '@fotosposi/core';
import { getEventById, getEventWindow } from '@fotosposi/events';

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!files || files.length === 0) return;

    const { user } = await getCurrentUser();
    if (!user) { router.push('/login'); return; }

    const { event } = await getEventById(eventId);
    if (!event) { setProgress('Evento non trovato'); return; }

    const isCreator = event.created_by === user.id;
    if (!isCreator) {
      const { window } = await getEventWindow(eventId);
      if (window) {
        const now = new Date();
        if (now < new Date(window.opens_at)) {
          setProgress('Il caricamento non è ancora disponibile. La finestra si apre ' + new Date(window.opens_at).toLocaleDateString('it-IT'));
          return;
        }
        if (now > new Date(window.closes_at)) {
          setProgress('Il periodo di caricamento è terminato (chiuso il ' + new Date(window.closes_at).toLocaleDateString('it-IT') + ')');
          return;
        }
      }
    }

    setUploading(true);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      setProgress(`Elaborazione ${i + 1}/${files.length}: ${file.name}`);

      try {
        const compressed = file.type.startsWith('video/') ? file : await compressImage(file);
        const ext = file.type.startsWith('video/') ? file.name.split('.').pop() : 'jpg';
        const path = `${eventId}/${Date.now()}_${i}.${ext}`;

        const { url, error: uploadError } = await uploadToStorage('media', path, compressed);
        if (uploadError || !url) { failed++; continue; }

        const { error: recordError } = await createMediaRecord({
          event_id: eventId,
          uploaded_by: user.id,
          type: file.type.startsWith('video/') ? 'video' : 'photo',
          url,
        });
        if (recordError) { failed++; continue; }

        success++;
      } catch {
        failed++;
      }
    }

    setResult({ success, failed });
    setUploading(false);
    setProgress(`Completato: ${success} caricati, ${failed} falliti`);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <main style={{ maxWidth: 600, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Carica foto e video</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={(e) => setFiles(e.target.files)}
            disabled={uploading}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {progress && (
          <p style={{ marginBottom: '1rem', color: uploading ? '#555' : '#090' }}>{progress}</p>
        )}
        <button
          type="submit"
          disabled={uploading || !files || files.length === 0}
          style={{ padding: '0.5rem 2rem', fontSize: '1rem', cursor: 'pointer' }}
        >
          {uploading ? 'Caricamento...' : 'Carica'}
        </button>
      </form>
      <p style={{ marginTop: '1rem' }}>
        <a href={`/events/${eventId}`} style={{ color: '#d4a574' }}>← Torna all'evento</a>
      </p>
    </main>
  );
}
