'use client';

import { useEffect, useState, useRef } from 'react';
import { hasFeature, type Tier } from '@fotosposi/core';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ShareButton, Countdown } from '@fotosposi/ui';
import { shareWatermarkedMedia } from '@/lib/share-watermarked';
import { Share2, Church, Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { WeddingEvent, SubEvent, EventWindow } from '@fotosposi/events';
import type { MediaUpload } from '@fotosposi/media';
import EventTimelineFeed from '@/components/event-timeline-feed';
import FullGalleryLightbox from '@/components/full-gallery-lightbox';

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
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [evtWindow, setEvtWindow] = useState<EventWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCountdown, setShowCountdown] = useState(true);
  const [isCreator, setIsCreator] = useState(false);
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
        setIsCreator(d.isCreator ?? false);
      }
      if (d.subEvents) setSubEvents(d.subEvents);
      if (d.window) setEvtWindow(d.window);
      if (m.media) setMedia(m.media);
      if (m.videoMessages) setVideos(m.videoMessages);
      setLoading(false);
    });
  }, [eventId]);

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
        <main className="max-w-7xl mx-auto p-4 space-y-4">
          {/* Intestazione evento: full-width sopra le 3 colonne */}
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
          </div>

          {evtWindow && (
            <Card className="bg-muted">
              <CardContent className="py-3 text-sm">
                {new Date(evtWindow.opens_at).toLocaleDateString()} — {new Date(evtWindow.closes_at).toLocaleDateString()}
              </CardContent>
            </Card>
          )}

          {/* ─── LAYOUT 3 COLONNE: servizi sx | feed centrale | servizi dx ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_200px] gap-4">
            {/* Sidebar SINISTRA — azioni per TUTTI */}
            <aside className="space-y-2 order-2 lg:order-1">
              <p className="text-xs uppercase tracking-wide text-text-muted px-1">Partecipa</p>
              <Button variant="default" className="w-full justify-center" asChild><Link href={`/events/${eventId}/upload`}>{c('upload')}</Link></Button>
              <Button variant="secondary" className="w-full justify-center" asChild><Link href={`/events/${eventId}/games`}>{t('games')}</Link></Button>
              <Button variant="secondary" className="w-full justify-center" asChild><Link href={`/events/${eventId}/shop`}>{t('shop')}</Link></Button>
              <Button variant="outline" className="w-full justify-center" asChild><Link href={`/events/${eventId}/guestbook`}>{t('guestbook')}</Link></Button>
              <Button variant="outline" className="w-full justify-center" asChild><Link href={`/events/${eventId}/wall`}>{t('wall')}</Link></Button>
              <Button variant="outline" className="w-full justify-center" asChild><Link href={`/events/${eventId}/video-challenges`}>{t('video_challenges')}</Link></Button>
              <Button variant="outline" className="w-full justify-center" asChild><Link href={`/events/${eventId}/wow-walk`}>{t('wow_walk')}</Link></Button>
            </aside>

            {/* COLONNA CENTRALE — feed timeline stile Facebook */}
            <section className="order-1 lg:order-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                  <CardTitle>{c('gallery')} ({media.length + videos.length})</CardTitle>
                  <Button variant="default" size="sm" asChild>
                    <Link href={`/events/${eventId}/upload`}>{c('upload')}</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {media.length === 0 && videos.length === 0 ? (
                    <p className="text-text-muted">{c('no_results')}</p>
                  ) : (
                    <EventTimelineFeed
                      media={media}
                      videos={videos}
                      event={event}
                      eventId={eventId}
                      onShareMedia={(id, isVideo) => {
                        const brand = typeof window !== 'undefined' && window.location.hostname.includes('justmarry')
                          ? 'JustMarry.live'
                          : 'Sposi.live';
                        shareWatermarkedMedia(id, eventId, isVideo, `${event?.couple_name} — ${brand}`);
                      }}
                      onOpenImage={(url) => setLightbox(url)}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Sub-eventi + share/back */}
              <Card className="mt-4">
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

              <div className="flex items-center gap-4 mt-4">
                <ShareButton
                  eventUrl={typeof globalThis !== 'undefined' ? globalThis.location?.href ?? '' : ''}
                  title={event.couple_name}
                />
                <Button variant="link" asChild><Link href="/dashboard">{c('back')}</Link></Button>
              </div>
            </section>

            {/* Sidebar DESTRA — solo SPOSI (creatore evento) */}
            {isCreator && (
              <aside className="space-y-2 order-3">
                <p className="text-xs uppercase tracking-wide text-text-muted px-1">Gestione sposi</p>
                <Button variant="outline" className="w-full justify-start" asChild><Link href={`/events/${eventId}/notifications`}>{t('notifications')}</Link></Button>
                <Button variant="outline" className="w-full justify-start" asChild><Link href={`/events/${eventId}/concierge`}>{t('concierge')}</Link></Button>
                <Button variant="outline" className="w-full justify-start" asChild><Link href={`/events/${eventId}/guests`}>{t('guests')}</Link></Button>
                <Button variant="outline" className="w-full justify-start" asChild><Link href={`/events/${eventId}/capsule`}>Capsula del Tempo</Link></Button>
                <Button variant="outline" className="w-full justify-start" asChild><Link href={`/kiosk/${event.code || eventId}`}>{t('kiosk')}</Link></Button>
                <Button variant="outline" className="w-full justify-start" asChild><Link href={`/events/${eventId}/qr`}>{t('qr_code')}</Link></Button>
                <Button variant="secondary" className="w-full justify-start" asChild><Link href={`/events/${eventId}/settings`}>⚙️ Impostazioni</Link></Button>
              </aside>
            )}
          </div>
        </main>
      </div>}
      <FullGalleryLightbox
        media={media}
        initialUrl={lightbox}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}
