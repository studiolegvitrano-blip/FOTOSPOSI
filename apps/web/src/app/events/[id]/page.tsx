'use client';

import { useEffect, useState } from 'react';
import { getEventById, getSubEvents, getEventWindow } from '@fotosposi/events';
import { useParams } from 'next/navigation';
import type { WeddingEvent, SubEvent, EventWindow } from '@fotosposi/events';

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [window, setWindow] = useState<EventWindow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      getEventById(eventId),
      getSubEvents(eventId),
      getEventWindow(eventId),
    ]).then(([e, s, w]) => {
      if (e.event) setEvent(e.event);
      if (s.subEvents) setSubEvents(s.subEvents);
      if (w.window) setWindow(w.window);
      setLoading(false);
    });
  }, [eventId]);

  if (loading) return <p>Caricamento...</p>;
  if (!event) return <p>Evento non trovato</p>;

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>{event.couple_name}</h1>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        {new Date(event.date).toLocaleDateString('it-IT')} — {event.location}
      </p>
      <p>Piano: <strong>{event.tier}</strong></p>

      {window && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f4f8', borderRadius: 8 }}>
          <p>Finestra di accesso: {new Date(window.opens_at).toLocaleDateString('it-IT')} — {new Date(window.closes_at).toLocaleDateString('it-IT')}</p>
        </div>
      )}

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
    </main>
  );
}
