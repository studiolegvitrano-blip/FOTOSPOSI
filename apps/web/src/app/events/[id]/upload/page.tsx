'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { compressImage, uploadToStorage, deleteFromStorage, createMediaRecord, updateDriveSyncStatus, getDriveToken } from '@fotosposi/media';
import { getCurrentUser } from '@fotosposi/core';
import { getEventById, getEventWindow } from '@fotosposi/events';

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<{ success: number; failed: number; drive: number }>({ success: 0, failed: 0, drive: 0 });
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

    const { token } = await getDriveToken(eventId);
    const hasDrive = !!token?.access_token;

    setUploading(true);
    let success = 0;
    let failed = 0;
    let drive = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      setProgress(`Elaborazione ${i + 1}/${files.length}: ${file.name}`);

      try {
        const isVideo = file.type.startsWith('video/');
        const ext = isVideo ? (file.name.split('.').pop() || 'mp4') : 'jpg';
        const ts = Date.now();
        const origPath = `${eventId}/orig_${ts}_${i}.${ext}`;
        const thumbPath = `${eventId}/thumb_${ts}_${i}.${ext}`;

        // 1. Upload ORIGINALE (qualità piena) a Supabase Storage (buffer temporaneo)
        const { url: origUrl, error: origError } = await uploadToStorage('media', origPath, file);
        if (origError || !origUrl) { failed++; continue; }

        // 2. Upload COMPRESSO (per galleria web, anteprima rapida)
        const compressed = isVideo ? file : await compressImage(file);
        await uploadToStorage('media', thumbPath, compressed);

        // 3. Crea record media con URL compresso (per galleria)
        const { media, error: recordError } = await createMediaRecord({
          event_id: eventId,
          uploaded_by: user.id,
          type: isVideo ? 'video' : 'photo',
          url: thumbPath,
        });
        if (recordError || !media) { failed++; continue; }

        // 4. Sync ORIGINALE a Google Drive (se OAuth configurato)
        let driveFileId: string | null = null;
        if (hasDrive) {
          try {
            const fileRes = await fetch(origUrl);
            const fileBlob = await fileRes.blob();

            // Verifica qualità: il blob deve avere dimensioni credibili
            if (fileBlob.size < 1024) throw new Error('File troppo piccolo, possibilmente corrotto');

            const formData = new FormData();
            formData.append('file', fileBlob, file.name);
            const metadata = { name: file.name };
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

            const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2Csize', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token.access_token}` },
              body: formData,
            });
            const driveData = await driveRes.json();

            if (driveRes.ok && driveData.id) {
              driveFileId = driveData.id;
              // 5. Verifica: Drive API ha confermato upload, aggiorniamo status
              await updateDriveSyncStatus(media.id, 'synced', driveFileId);

              // 6. Cancella ORIGINALE da Supabase Storage (solo buffer temporaneo)
              await deleteFromStorage('media', origPath);

              drive++;
            } else {
              await updateDriveSyncStatus(media.id, 'failed');
            }
          } catch {
            await updateDriveSyncStatus(media.id, 'failed');
          }
        }

        success++;
      } catch {
        failed++;
      }
    }

    setResult({ success, failed, drive });
    setUploading(false);
    const driveMsg = hasDrive ? `, ${drive} sincronizzati su Drive` : '';
    setProgress(`Completato: ${success} caricati, ${failed} falliti${driveMsg}`);
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
