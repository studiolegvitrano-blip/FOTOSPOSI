'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@fotosposi/core';
import { getCuratedMediaByEvent } from '@fotosposi/media';
import type { MediaUpload } from '@fotosposi/media';

export default function WallPage() {
  const params = useParams();
  const eventId = params.id as string;
  const t = useTranslations('wall');
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [page, setPage] = useState(0);
  const itemsPerPage = 12;
  const loaded = useRef(false);

  useEffect(() => {
    if (!eventId) return;
    const supabase = createClient();

    getCuratedMediaByEvent(eventId).then((r) => {
      if (r.media) {
        setMedia(r.media);
        loaded.current = true;
      }
    });

    const channel = supabase
      .channel(`wall-${eventId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'media_uploads', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const m = payload.new as MediaUpload;
          setMedia((prev) => [m, ...prev]);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
        <h1 style={{ fontSize: '2rem', color: '#d4a574' }}>{t('title')}</h1>
        <p style={{ color: '#888' }}>{media.length} {t('subtitle')}</p>
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
            position: 'relative',
          }}>
            {m.type === 'photo' ? (
              <img src={m.url} alt="" style={{ width: '100%', height: 250, objectFit: 'cover' }} />
            ) : (
              <video src={m.url} style={{ width: '100%', height: 250, objectFit: 'cover' }} autoPlay muted loop />
            )}
            {m.compressed && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(200,100,0,0.7)', color: '#fff',
                fontSize: '0.6rem', padding: '2px 6px', borderRadius: 4,
              }}>
                SD
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link href={`/events/${eventId}/games`} style={{ color: '#d4a574' }}>{t('refresh')}</Link>
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
