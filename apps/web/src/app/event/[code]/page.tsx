'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { validateQrToken } from '@fotosposi/core';
import { getEventById, getSubEvents } from '@fotosposi/events';
import { getMediaByEvent } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  const [mode, setMode] = useState<'gallery' | 'live'>('gallery');
  const [slideIdx, setSlideIdx] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>(undefined);

  const loadData = async (eventId: string) => {
    const [e, s, m] = await Promise.all([
      getEventById(eventId),
      getSubEvents(eventId),
      getMediaByEvent(eventId),
    ]);
    if (e.event) setEvent(e.event);
    if (s.subEvents) setSubEvents(s.subEvents);
    if (m.media) setMedia(m.media);
    setLoading(false);
  };

  useEffect(() => {
    if (!code) return;
    validateQrToken(code).then(async (result) => {
      const eid = result.event_id;
      if (!result.valid || !eid) {
        setError('Link non valido o scaduto');
        setLoading(false);
        return;
      }
      await loadData(eid);
      const interval = setInterval(() => loadData(eid), 15000);
      return () => clearInterval(interval);
    });
  }, [code]);

  useEffect(() => {
    if (mode === 'live' && media.length > 0) {
      timerRef.current = setInterval(() => {
        setSlideIdx(prev => (prev + 1) % media.length);
      }, 5000);
      return () => clearInterval(timerRef.current);
    }
  }, [mode, media.length]);

  const photos = media.filter(m => m.type === 'photo');

  if (loading) return <p className="text-center mt-8">Caricamento...</p>;
  if (error) return <main className="max-w-lg mx-auto mt-8 p-4 text-center"><h1 className="text-xl font-bold">{error}</h1></main>;
  if (!event) return null;

  return (
    <main className="max-w-4xl mx-auto">
      {mode === 'live' && photos.length > 0 && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
          <button onClick={() => setMode('gallery')} className="absolute top-4 right-4 text-white/60 hover:text-white z-10 text-sm bg-white/10 px-3 py-1 rounded-full">
            Esci live
          </button>
          <div className="text-white/40 absolute bottom-4 text-sm">{slideIdx + 1} / {photos.length}</div>
          {photos[slideIdx] && <img src={photos[slideIdx].url} alt="" className="max-w-full max-h-full object-contain" />}
        </div>
      )}

      <div className="p-4 space-y-6">
        <div className="text-center py-4">
          <h1 className="text-3xl font-bold">{event.couple_name}</h1>
          <p className="text-text-muted">{new Date(event.date).toLocaleDateString('it-IT')} — {event.location}</p>
        </div>

        <div className="flex gap-2 justify-center">
          <Button variant={mode === 'gallery' ? 'default' : 'outline'} onClick={() => setMode('gallery')}>Galleria</Button>
          {photos.length > 0 && (
            <Button variant={mode === 'live' ? 'default' : 'outline'} onClick={() => { setMode('live'); setSlideIdx(0); }}>
              Live ({photos.length})
            </Button>
          )}
          <Button variant="outline" asChild><a href={`/events/${event.id}/upload`}>Carica</a></Button>
          <Button variant="outline" asChild><a href={`/events/${event.id}/games/jokes`}>Scherzi</a></Button>
          <Button variant="outline" asChild><a href={`/events/${event.id}/guestbook`}>Video</a></Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {media.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <CardContent className="p-1">
                {m.type === 'photo'
                  ? <img src={m.url} alt="" className="w-full h-36 object-cover rounded" />
                  : <video src={m.url} className="w-full h-36 object-cover rounded" controls />}
              </CardContent>
            </Card>
          ))}
          {media.length === 0 && (
            <p className="col-span-full text-center text-text-muted py-8">Ancora nessuna foto. Carica la prima!</p>
          )}
        </div>

        {subEvents.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Programma</h2>
            {subEvents.map((s) => (
              <Card key={s.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.title}</p>
                    <p className="text-sm text-text-muted">{new Date(s.date).toLocaleDateString('it-IT')}{s.location ? ` — ${s.location}` : ''}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
