'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getMediaByEvent } from '@fotosposi/media';
import type { MediaUpload } from '@fotosposi/media';

export default function WallPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [page, setPage] = useState(0);
  const itemsPerPage = 12;

  useEffect(() => {
    if (!eventId) return;
    const interval = setInterval(() => {
      getMediaByEvent(eventId).then((r) => { if (r.media) setMedia(r.media); });
    }, 10000);
    getMediaByEvent(eventId).then((r) => { if (r.media) setMedia(r.media); });
    return () => clearInterval(interval);
  }, [eventId]);

  useEffect(() => {
    const autoScroll = setInterval(() => {
      setPage((prev) => {
        const maxPage = Math.ceil(media.length / itemsPerPage);
        return prev >= maxPage - 1 ? 0 : prev + 1;
      });
    }, 8000);
    return () => clearInterval(autoScroll);
  }, [media.length]);

  const displayed = media.slice(page * itemsPerPage, (page + 1) * itemsPerPage);

  return (
    <main style={{ minHeight: '100vh', background: '#111', color: '#fff', padding: '1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '2rem', color: '#d4a574' }}>Wall</h1>
        <p style={{ color: '#888' }}>{media.length} foto • si aggiorna ogni 10s</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: '0.5rem',
        maxWidth: 1400,
        margin: '0 auto',
      }}>
        {displayed.map((m) => (
          <div key={m.id} style={{
            overflow: 'hidden',
            borderRadius: 8,
            animation: 'fadeIn 0.5s ease',
          }}>
            {m.type === 'photo' ? (
              <img src={m.url} alt="" style={{ width: '100%', height: 250, objectFit: 'cover' }} />
            ) : (
              <video src={m.url} style={{ width: '100%', height: 250, objectFit: 'cover' }} autoPlay muted loop />
            )}
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link href={`/events/${eventId}/games`} style={{ color: '#d4a574' }}>← Torna ai giochi</Link>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </main>
  );
}
