'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { validateQrToken } from '@fotosposi/core';
import { getEventById, getSubEvents } from '@fotosposi/events';
import { getMediaByEvent } from '@fotosposi/media';
import type { WeddingEvent, SubEvent } from '@fotosposi/events';
import type { MediaUpload } from '@fotosposi/media';

export default function GuestEventPage() {
  const params = useParams();
  const code = params.code as string;
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;

    validateQrToken(code).then(async (result) => {
      if (!result.valid || !result.event_id) {
        setError('Link non valido o scaduto');
        setLoading(false);
        return;
      }

      const [e, s, m] = await Promise.all([
        getEventById(result.event_id),
        getSubEvents(result.event_id),
        getMediaByEvent(result.event_id),
      ]);

      if (e.event) setEvent(e.event);
      if (s.subEvents) setSubEvents(s.subEvents);
      if (m.media) setMedia(m.media);
      setLoading(false);
    });
  }, [code]);

  if (loading) return <p style={{ padding: '2rem', textAlign: 'center' }}>Caricamento...</p>;
  if (error) return <main style={{ maxWidth: 600, margin: '2rem auto', padding: '1rem', textAlign: 'center' }}><h1>{error}</h1></main>;
  if (!event) return null;

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '1rem' }}>
      <div style={{ textAlign: 'center', padding: '2rem 0' }}>
        <h1 style={{ fontSize: '2rem' }}>{event.couple_name}</h1>
        <p style={{ color: '#555', fontSize: '1.1rem' }}>
          {new Date(event.date).toLocaleDateString('it-IT')} — {event.location}
        </p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Galleria</h2>
          <a href={`/events/${event.id}/upload`} style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6 }}>
            Carica foto/video
          </a>
        </div>
        {media.length === 0 ? (
          <p style={{ color: '#666' }}>Ancora nessuna foto. Sei il primo a caricare!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {media.map((m) => (
              <div key={m.id} style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                {m.type === 'photo' ? (
                  <img src={m.url} alt="" style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                ) : (
                  <video src={m.url} style={{ width: '100%', height: 200, objectFit: 'cover' }} controls />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {subEvents.length > 0 && (
        <div>
          <h2>Sotto-eventi</h2>
          <ul>
            {subEvents.map((s) => (
              <li key={s.id} style={{ marginBottom: '0.5rem' }}>
                <strong>{s.title}</strong> — {new Date(s.date).toLocaleDateString('it-IT')}
                {s.location && <span> — {s.location}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
