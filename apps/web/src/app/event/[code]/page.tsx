'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { validateQrToken } from '@fotosposi/core';
import { getEventById, getSubEvents } from '@fotosposi/events';
import { getMediaByEvent } from '@fotosposi/media';
import { getEventWindow } from '@fotosposi/events';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { WeddingEvent, SubEvent, EventWindow } from '@fotosposi/events';
import type { MediaUpload } from '@fotosposi/media';

function makeHashtag(name: string): string {
  return '#' + name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + 'sposi';
}

export default function GuestEventPage() {
  const params = useParams();
  const code = params.code as string;
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState<EventWindow | null>(null);
  const [mode, setMode] = useState<'gallery' | 'live'>('gallery');
  const [slideIdx, setSlideIdx] = useState(0);
  const timerRef = useRef<NodeJS.Timeout>(undefined);

  const loadData = async (eventId: string) => {
    const [e, s, m, w] = await Promise.all([
      getEventById(eventId),
      getSubEvents(eventId),
      getMediaByEvent(eventId),
      getEventWindow(eventId),
    ]);
    if (e.event) setEvent(e.event);
    if (s.subEvents) setSubEvents(s.subEvents);
    if (m.media) setMedia(m.media);
    if (w.window) setWindow(w.window);
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

  const [shareLoading, setShareLoading] = useState<string | null>(null);

  const handleShare = useCallback(async (mediaId: string, coupleName: string, brand: string) => {
    if (!event) return;
    const hashtag = makeHashtag(coupleName);
    const appTag = brand === 'fotosposi' ? '@fotosposi' : '@weddingmoments';
    const shareText = `Che meraviglia! 💍 ${coupleName}\n\n${hashtag} ${appTag}`;

    setShareLoading(mediaId);
    try {
      const resp = await fetch(`/api/photos/${mediaId}/share?eventId=${event.id}&format=story`);
      if (!resp.ok) throw new Error('share failed');
      const blob = await resp.blob();
      const file = new File([blob], 'photo_story.jpg', { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'photo_story.jpg'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      const url = `/api/photos/${mediaId}/share?eventId=${event.id}&format=story`;
      const a = document.createElement('a');
      a.href = url; a.download = 'photo_story.jpg'; a.click();
    }
    setShareLoading(null);
  }, [event]);

  function mediaUrl(m: { id: string; r2_key: string | null; url: string }): string {
    return m.r2_key ? `/api/media/${m.id}/download` : m.url;
  }

  const photos = media.filter(m => m.type === 'photo');
  const now = new Date();
  const canUpload = !window || (now >= new Date(window.opens_at) && now <= new Date(window.closes_at));

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
          {photos[slideIdx] && <img src={mediaUrl(photos[slideIdx])} alt="" className="max-w-full max-h-full object-contain" />}
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
          {canUpload
            ? <Button variant="outline" asChild><a href={`/events/${event.id}/upload`}>Carica</a></Button>
            : <Button variant="outline" disabled>Carica (finestra chiusa)</Button>}
          <Button variant="outline" asChild><a href={`/events/${event.id}/games/jokes`}>Scherzi</a></Button>
          <Button variant="outline" asChild><a href={`/events/${event.id}/guestbook`}>Video</a></Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {media.map((m) => (
            <Card key={m.id} className="overflow-hidden group relative">
              <CardContent className="p-1">
                {m.type === 'photo'
                  ? <img src={mediaUrl(m)} alt="" className="w-full h-36 object-cover rounded" />
                  : <video src={mediaUrl(m)} className="w-full h-36 object-cover rounded" controls />}
              </CardContent>
              {m.type === 'photo' && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => handleShare(m.id, event.couple_name, event.brand)}
                    disabled={shareLoading === m.id}
                    className="bg-white/90 text-sm px-2 py-1.5 rounded hover:bg-white flex items-center gap-1 disabled:opacity-50"
                    title="Condividi su Instagram, Facebook, WhatsApp"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    <span className="text-xs">{shareLoading === m.id ? '...' : 'Condividi'}</span>
                  </button>
                  <a
                    href={`/api/photos/${m.id}/share?eventId=${event.id}&format=square`}
                    download
                    className="bg-white/90 text-sm px-2 py-1.5 rounded hover:bg-white"
                    title="Scarica foto"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                </div>
              )}
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
