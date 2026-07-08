'use client';

import { useEffect, useState, useRef } from 'react';
import { updateEventWatermark } from '@fotosposi/events';
import { hasFeature, type Tier } from '@fotosposi/core';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ShareButton, Countdown } from '@fotosposi/ui';
import { shareWatermarkedMedia } from '@/lib/share-watermarked';
import { Share2, Download, Church, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WeddingEvent, SubEvent, EventWindow } from '@fotosposi/events';
import type { MediaUpload } from '@fotosposi/media';

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const t = useTranslations('events');
  const c = useTranslations('common');
  function mediaUrl(m: MediaUpload): string {
    return m.r2_key ? `/api/media/${m.id}/download` : m.url;
  }

  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [videos, setVideos] = useState<MediaUpload[]>([]);
  const [evtWindow, setEvtWindow] = useState<EventWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCountdown, setShowCountdown] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
  // Impostazioni watermark (solo sposi): nomi impressi sì/no + testo personalizzato.
  const [wmNames, setWmNames] = useState(true);
  const [wmText, setWmText] = useState('');
  const [wmSaving, setWmSaving] = useState(false);
  const [wmSaved, setWmSaved] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      fetch(`/api/events/${eventId}/details`)
        .then((r) => (r.ok ? r.json() : { event: null }))
        .catch(() => ({ event: null })),
      fetch(`/api/events/${eventId}/media`)
        .then((r) => (r.ok ? r.json() : { media: [], videoMessages: [] }))
        .catch(() => ({ media: [], videoMessages: [] })),
    ]).then(([d, m]) => {
      if (d.event) {
        setEvent(d.event);
        setWmNames(d.event.watermark_names !== false);
        setWmText(d.event.watermark_text || '');
        setIsCreator(d.isCreator ?? false);
      }
      if (d.subEvents) setSubEvents(d.subEvents);
      if (d.window) setEvtWindow(d.window);
      if (m.media) setMedia(m.media);
      if (m.videoMessages) setVideos(m.videoMessages);
      setLoading(false);
    });
  }, [eventId]);

  const saveWatermark = async () => {
    setWmSaving(true);
    setWmSaved(false);
    const { error } = await updateEventWatermark(eventId, { watermark_names: wmNames, watermark_text: wmText });
    setWmSaving(false);
    if (!error) { setWmSaved(true); setTimeout(() => setWmSaved(false), 3000); }
    else alert(`Salvataggio non riuscito: ${error}`);
  };

  if (loading) return <p className="text-center mt-8">{c('loading')}</p>;
  if (!event) return <p className="text-center mt-8">{c('no_results')}</p>;

  const tier = (event.tier || 'free') as Tier;
  const showWidget = showCountdown && hasFeature(tier, 'countdown_widget');

  return (
    <>
      {showWidget && (
        <Countdown
          targetDate={event.date}
          coupleName={event.couple_name}
          onEnter={() => { setShowCountdown(false); contentRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
        />
      )}

      {!showWidget && <div ref={contentRef}>
        <main className="max-w-4xl mx-auto p-4 space-y-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold">{event.couple_name}</h1>
              <p className="text-text-muted">
                {new Date(event.date).toLocaleDateString()} — {event.location}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted mt-1">
                {event.church && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.church, event.church_address, event.church_city || event.location].filter(Boolean).join(', '))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-brand transition-colors no-underline text-text-muted"
                    title="Apri nel navigatore"
                  >
                    <Church className="w-4 h-4" /> {event.church}{event.church_address ? ` — ${event.church_address}` : ''}
                  </a>
                )}
                {event.venue && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([event.venue, event.venue_address, event.venue_city || event.location].filter(Boolean).join(', '))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-brand transition-colors no-underline text-text-muted"
                    title="Apri nel navigatore"
                  >
                    <Building2 className="w-4 h-4" /> {event.venue}{event.venue_address ? ` — ${event.venue_address}` : ''}
                  </a>
                )}
              </div>
              <Badge variant={event.tier === 'premium' ? 'default' : 'secondary'}>{event.tier}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" asChild><Link href={`/events/${eventId}/upload`}>{c('upload')}</Link></Button>
              <Button variant="secondary" asChild><Link href={`/events/${eventId}/games`}>{t('games')}</Link></Button>
              <Button variant="secondary" asChild><Link href={`/events/${eventId}/shop`}>{t('shop')}</Link></Button>
              {/* gift_registry rimosso */}
              <Button variant="outline" asChild><Link href={`/events/${eventId}/guestbook`}>{t('guestbook')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/notifications`}>{t('notifications')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/concierge`}>{t('concierge')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/guests`}>{t('guests')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/privacy`}>{t('privacy')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/drive`}>{t('drive')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/site-builder`}>{t('site_builder')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/wall`}>{t('wall')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/video-challenges`}>{t('video_challenges')}</Link></Button>
              <Button variant="outline" asChild><Link href={`/events/${eventId}/wow-walk`}>{t('wow_walk')}</Link></Button>
              {/* Capsula del Tempo: pagina di gestione già esistente ma mai linkata. */}
              <Button variant="outline" asChild><Link href={`/events/${eventId}/capsule`}>Capsula del Tempo</Link></Button>
              <Button variant="outline" asChild><Link href={`/kiosk/${event.code || eventId}`}>{t('kiosk')}</Link></Button>
              {/* social-wall rimosso */}
              <Button variant="outline" asChild><Link href={`/events/${eventId}/qr`}>{t('qr_code')}</Link></Button>
            </div>
          </div>

          {evtWindow && (
            <Card className="bg-muted">
              <CardContent className="py-3 text-sm">
                {new Date(evtWindow.opens_at).toLocaleDateString()} — {new Date(evtWindow.closes_at).toLocaleDateString()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{c('gallery')} ({media.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {media.length === 0 ? (
                <p className="text-text-muted">{c('no_results')}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {media.slice(0, 12).map((m) => (
                    <div key={m.id} className="relative group rounded-md overflow-hidden border border-border">
                      {m.type === 'photo'
                        ? <img src={mediaUrl(m)} alt="" className="w-full h-28 object-cover" loading="lazy" />
                        : <video src={mediaUrl(m)} className="w-full h-28 object-cover bg-black" controls preload="metadata" />}
                      {/* Sempre visibili (non solo on-hover): su mobile/touch non esiste hover,
                          quindi i pulsanti per-foto restavano invisibili e inutilizzabili. */}
                      <div className="absolute bottom-1 right-1 flex items-center gap-1.5">
                        <button
                          onClick={() => shareWatermarkedMedia(m.id, eventId, m.type !== 'photo', `${event?.couple_name} — ${typeof window !== 'undefined' && window.location.hostname.includes('justmarry') ? 'JustMarry.live' : 'Sposi.live'}`)}
                          className="p-1.5 bg-white/90 rounded-full shadow hover:bg-white transition-colors"
                          title="Condividi"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <a href={mediaUrl(m)} download className="p-1.5 bg-white/90 rounded-full shadow hover:bg-white transition-colors" title="Scarica">
                          <Download className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {videos.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Video Guestbook ({videos.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {videos.map((v) => {
                    const videoId = String(v.id);
                    const r2Key = v.r2_key as string;
                    const src = r2Key ? `/api/media/${videoId}/download` : (v as unknown as { url: string }).url ?? '';
                    const author = (v as unknown as { from_name?: string }).from_name;
                    return (
                      <div key={videoId} className="relative rounded-md overflow-hidden border border-border">
                        <video
                          src={src}
                          className="w-full h-28 object-cover bg-black"
                          controls
                          preload="none"
                          // poster placeholder — evita richiesta HTTP se non serve
                          poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23111' width='200' height='150'/%3E%3Ccircle cx='100' cy='75' r='18' fill='%23444'/%3E%3Cpolygon points='95,65 95,85 110,75' fill='%23888'/%3E%3C/svg%3E"
                        />
                        {author && (
                          <p className="absolute top-1 left-1 right-1 text-xs text-white bg-black/60 px-2 py-0.5 rounded truncate">
                            {author}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>{t('subtitle')}</CardTitle></CardHeader>
            <CardContent>
              {subEvents.length === 0 ? (
                <p className="text-text-muted">{c('no_results')}</p>
              ) : (
                <div className="space-y-2">
                  {subEvents.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                      <div>
                        <p className="font-medium">{s.title}</p>
                        <p className="text-sm text-text-muted">{new Date(s.date).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline">{s.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {isCreator && (
            <Card>
              <CardHeader><CardTitle className="text-base">Impostazioni foto e video</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={wmNames} onChange={(e) => setWmNames(e.target.checked)} />
                  Vuoi che nelle foto e nei video ci siano impressi i Vostri nomi?
                </label>
                {wmNames && (
                  <div className="space-y-2">
                    <p className="text-xs text-text-muted">Scegli un suggerimento o scrivi il testo che preferisci:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        [event.couple_name, 'Sposi', event.location, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' '),
                        [event.couple_name, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' — '),
                        ['W gli Sposi!', event.couple_name, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' '),
                      ].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setWmText(s)}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${wmText === s ? 'border-brand bg-brand/10 font-medium' : 'border-border bg-background hover:border-brand/50'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      maxLength={80}
                      placeholder={`es. ${event.couple_name} Sposi ${event.location} ${new Date(event.date).toLocaleDateString('it-IT')}`}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
                    />
                    <p className="text-xs text-text-muted">Se lasci vuoto verranno impressi nomi e data. Il logo Sposi.live è sempre presente.</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={saveWatermark} disabled={wmSaving}>
                    {wmSaving ? 'Salvataggio...' : 'Salva'}
                  </Button>
                  {wmSaved && <span className="text-sm text-success">Salvato ✓</span>}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-4">
            <ShareButton
              eventUrl={typeof globalThis !== 'undefined' ? globalThis.location?.href ?? '' : ''}
              title={event.couple_name}
            />
            <Button variant="link" asChild><Link href="/dashboard">{c('back')}</Link></Button>
          </div>
        </main>
      </div>}
    </>
  );
}
