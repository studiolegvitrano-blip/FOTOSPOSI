'use client';

import { useEffect, useState } from 'react';
import { getEventById, getSubEvents, getEventWindow } from '@fotosposi/events';
import { getMediaByEvent } from '@fotosposi/media';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShareButton } from '@fotosposi/ui';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

  if (loading) return <p className="text-center mt-8">Caricamento...</p>;
  if (!event) return <p className="text-center mt-8">Evento non trovato</p>;

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{event.couple_name}</h1>
          <p className="text-text-muted">
            {new Date(event.date).toLocaleDateString('it-IT')} — {event.location}
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted mt-1">
            {event.church && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.church + (event.location ? ', ' + event.location : ''))}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-brand transition-colors no-underline text-text-muted">
                ⛪ {event.church} <span className="text-xs opacity-60">↗</span>
              </a>
            )}
            {event.venue && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue + (event.location ? ', ' + event.location : ''))}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-brand transition-colors no-underline text-text-muted">
                🏛️ {event.venue} <span className="text-xs opacity-60">↗</span>
              </a>
            )}
          </div>
          <Badge variant={event.tier === 'premium' ? 'default' : 'secondary'}>{event.tier}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" asChild><Link href={`/events/${eventId}/upload`}>Carica foto</Link></Button>
          <Button variant="secondary" asChild><Link href={`/events/${eventId}/games`}>Giochi</Link></Button>
          <Button variant="secondary" asChild><Link href={`/events/${eventId}/shop`}>Shop</Link></Button>
          <Button variant="secondary" asChild><Link href={`/events/${eventId}/gift`}>Lista nozze</Link></Button>
          <Button variant="outline" asChild><Link href={`/events/${eventId}/guestbook`}>Video</Link></Button>
          <Button variant="outline" asChild><Link href={`/events/${eventId}/notifications`}>Notifiche</Link></Button>
          <Button variant="outline" asChild><Link href={`/events/${eventId}/concierge`}>Concierge</Link></Button>
          <Button variant="outline" asChild><Link href={`/events/${eventId}/privacy`}>Privacy</Link></Button>
          <Button variant="outline" asChild><Link href={`/events/${eventId}/drive`}>Drive</Link></Button>
          <Button variant="outline" asChild><Link href={`/events/${eventId}/site-builder`}>Sito evento</Link></Button>
          <Button variant="outline" asChild><Link href={`/events/${eventId}/qr`}>QR</Link></Button>
        </div>
      </div>

      {evtWindow && (
        <Card className="bg-muted">
          <CardContent className="py-3 text-sm">
            Finestra di accesso: {new Date(evtWindow.opens_at).toLocaleDateString('it-IT')} — {new Date(evtWindow.closes_at).toLocaleDateString('it-IT')}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Galleria ({media.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {media.length === 0 ? (
            <p className="text-text-muted">Nessuna foto ancora</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {media.slice(0, 12).map((m) => (
                <div key={m.id} className="rounded-md overflow-hidden border border-border">
                  {m.type === 'photo'
                    ? <img src={m.url} alt="" className="w-full h-28 object-cover" />
                    : <video src={m.url} className="w-full h-28 object-cover" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sotto-eventi</CardTitle></CardHeader>
        <CardContent>
          {subEvents.length === 0 ? (
            <p className="text-text-muted">Nessun sotto-evento ancora</p>
          ) : (
            <div className="space-y-2">
              {subEvents.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-text-muted">{new Date(s.date).toLocaleDateString('it-IT')}</p>
                  </div>
                  <Badge variant="outline">{s.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <ShareButton
          eventUrl={typeof globalThis !== 'undefined' ? globalThis.location?.href ?? '' : ''}
          title={`Evento ${event.couple_name} - FotoSposi`}
        />
        <Button variant="link" asChild><Link href="/dashboard">← Dashboard</Link></Button>
      </div>
    </main>
  );
}
