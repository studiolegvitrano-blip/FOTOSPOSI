'use client';

import { useEffect, useState, useRef } from 'react';
import { getEventById, getSubEvents, getEventWindow } from '@fotosposi/events';
import { getMediaByEvent } from '@fotosposi/media';
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
  const [evtWindow, setEvtWindow] = useState<EventWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCountdown, setShowCountdown] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

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
                        : <video src={mediaUrl(m)} className="w-full h-28 object-cover" />}
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
