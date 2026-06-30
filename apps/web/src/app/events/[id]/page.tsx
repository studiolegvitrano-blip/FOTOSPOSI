'use client';

import { useEffect, useState } from 'react';
import { getEventById, getSubEvents, getEventWindow } from '@fotosposi/events';
import { getMediaByEvent } from '@fotosposi/media';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShareButton } from '@fotosposi/ui';
import type { WeddingEvent, SubEvent, EventWindow } from '@fotosposi/events';
import type { MediaUpload } from '@fotosposi/media';

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [evtWindow, setEvtWindow] = useState<EventWindow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      getEventById(eventId),
      getSubEvents(eventId),
      getEventWindow(eventId),
      getMediaByEvent(eventId),
    ]).then(([e, s, w, m]) => {
      if (e.event) setEvent(e.event);
      if (s.subEvents) setSubEvents(s.subEvents);
      if (w.window) setEvtWindow(w.window);
      if (m.media) setMedia(m.media);
      setLoading(false);
    });
  }, [eventId]);

  if (loading) return <p>Caricamento...</p>;
  if (!event) return <p>Evento non trovato</p>;

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1>{event.couple_name}</h1>
          <p style={{ color: '#555', marginBottom: '1rem' }}>
            {new Date(event.date).toLocaleDateString('it-IT')} — {event.location}
          </p>
          <p>Piano: <strong>{event.tier}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href={`/events/${eventId}/upload`}
            style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6 }}>
            Carica foto
          </Link>
          <Link href={`/events/${eventId}/games`}
            style={{ padding: '0.5rem 1rem', background: '#8b5e3c', color: '#fff', textDecoration: 'none', borderRadius: 6 }}>
            Giochi
          </Link>
          <Link href={`/events/${eventId}/qr`}
            style={{ padding: '0.5rem 1rem', border: '2px solid #d4a574', color: '#d4a574', textDecoration: 'none', borderRadius: 6 }}>
            QR
          </Link>
        </div>
      </div>

      {evtWindow && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f4f8', borderRadius: 8 }}>
          <p>Finestra di accesso: {new Date(evtWindow.opens_at).toLocaleDateString('it-IT')} — {new Date(evtWindow.closes_at).toLocaleDateString('it-IT')}</p>
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <h2>Galleria ({media.length})</h2>
        {media.length === 0 ? (
          <p style={{ color: '#666' }}>Nessuna foto ancora</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
            {media.slice(0, 12).map((m) => (
              <div key={m.id} style={{ border: '1px solid #eee', borderRadius: 4, overflow: 'hidden' }}>
                {m.type === 'photo'
                  ? <img src={m.url} alt="" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                  : <video src={m.url} style={{ width: '100%', height: 120, objectFit: 'cover' }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Sotto-eventi</h2>
        {subEvents.length === 0 ? (
          <p style={{ color: '#666' }}>Nessun sotto-evento ancora</p>
        ) : (
          <ul>
            {subEvents.map((s) => (
              <li key={s.id}>{s.title} — {new Date(s.date).toLocaleDateString('it-IT')}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: '2rem' }}>
        <ShareButton
          eventUrl={typeof globalThis !== 'undefined' ? globalThis.location?.href ?? '' : ''}
          title={`Evento ${event.couple_name} - FotoSposi`}
        />
      </div>

      <p style={{ marginTop: '2rem' }}>
        <Link href="/dashboard" style={{ color: '#d4a574' }}>← Dashboard</Link>
      </p>
    </main>
  );
}
