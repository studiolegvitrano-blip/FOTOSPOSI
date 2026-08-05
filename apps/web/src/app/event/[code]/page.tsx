'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { hasFeature, type Tier } from '@fotosposi/core';
import { getCurrentUser } from '@fotosposi/core';
import { rememberLastEventCode } from '@/components/pwa-event-redirect';
import { ShareButton, Countdown, MiniCountdown } from '@fotosposi/ui';
import { shareWatermarkedMedia } from '@/lib/share-watermarked';
import { Church, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddToCalendarMenu } from '@/components/add-to-calendar-menu';
import WeatherWidget from '@/components/weather-widget';
import type { WeddingEvent, SubEvent, EventWindow } from '@fotosposi/events';
import type { MediaUpload } from '@fotosposi/media';
import EventTimelineFeed from '@/components/event-timeline-feed';
import MiniMusicWidget from '@/components/mini-music-widget';
import FullGalleryLightbox from '@/components/full-gallery-lightbox';

export default function GuestEventPage() {
  const params = useParams();
  const code = params.code as string;
  const t = useTranslations('events');
  const c = useTranslations('common');
  const j = useTranslations('jokes');

  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [subEvents, setSubEvents] = useState<SubEvent[]>([]);
  const [media, setMedia] = useState<MediaUpload[]>([]);
  const [videos, setVideos] = useState<MediaUpload[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [eventWindow, setEventWindow] = useState<EventWindow | null>(null);
  const [showCountdown, setShowCountdown] = useState(true);
  const [ceremonyTime, setCeremonyTime] = useState<string | undefined>();
  const [receptionTime, setReceptionTime] = useState<string | undefined>();
  const [lightbox, setLightbox] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const loadData = async (guestUser?: { id: string; name: string; email?: string }) => {
    const res = await fetch('/api/guest/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        guestUserId: guestUser?.id,
        guestName: guestUser?.name,
        guestEmail: guestUser?.email,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Link non valido o scaduto');
      setLoading(false);
      return;
    }
    if (data.event) setEvent(data.event);
    setSubEvents(data.subEvents ?? []);
    setMedia(data.media ?? []);
    setEventWindow(data.window ?? null);
    // Orari cerimonia/ricevimento dal SiteContent (site-builder), come su /events/[id].
    // Fallback 11:00/13:00 nel Countdown se assenti — fase countdown → cerimonia → ricevimento.
    if (typeof data.ceremonyTime === 'string') setCeremonyTime(data.ceremonyTime);
    if (typeof data.receptionTime === 'string') setReceptionTime(data.receptionTime);
    setLoading(false);
    // Se l'ospite installa l'app da qui ("Aggiungi a schermata Home"), la prossima apertura in
    // modalità standalone deve portare dritto a questo evento — vedi pwa-event-redirect.tsx.
    rememberLastEventCode(code);
  };

  useEffect(() => {
    if (!code) return;
    let interval: ReturnType<typeof setInterval> | undefined;
    getCurrentUser().then((u) => {
      const guestUser = u.user?.id
        ? {
            id: u.user.id,
            name: u.user.user_metadata?.full_name || u.user.user_metadata?.name || u.user.email || 'Ospite',
            email: u.user.email,
          }
        : undefined;
      loadData(guestUser);
      interval = setInterval(() => loadData(guestUser), 15000);
    });
    return () => clearInterval(interval);
  }, [code]);

  const handleShareMedia = useCallback(
    (id: string, isVideo: boolean) => {
      if (!event) return;
      const brand = typeof window !== 'undefined' && window.location.hostname.includes('justmarry')
        ? 'JustMarry.live'
        : 'Sposi.live';
      shareWatermarkedMedia(id, event.id, isVideo, `${event?.couple_name} — ${brand}`);
    },
    [event],
  );

  if (loading) return <p className="text-center mt-8">{c('loading')}</p>;
  if (error) return <main className="max-w-lg mx-auto mt-8 p-4 text-center"><h1 className="text-xl font-bold">{error}</h1></main>;
  if (!event) return null;

  const tier = (event.tier || 'free') as Tier;
  const showWidget = showCountdown && hasFeature(tier, 'countdown_widget');
  const photos = media.filter(m => m.type === 'photo');
  const now = new Date();
  const canUpload = !eventWindow || (now >= new Date(eventWindow.opens_at) && now <= new Date(eventWindow.closes_at));

  // Indirizzi cerimonia/ricevimento per il Countdown e per i link mappa (stesso calcolo
  // della pagina sposi /events/[id]).
  const ceremonyAddress = [event.church, event.church_address, event.church_city || event.location]
    .filter(Boolean)
    .join(', ');
  const receptionAddress = [event.venue, event.venue_address, event.venue_city || event.location]
    .filter(Boolean)
    .join(', ');

  // Titolo di benvenuto con nomi sposi (sposa prima, poi sposo) — stessa logica di /events/[id].
  const brideName =
    event.groom1_role === 'bride'
      ? event.groom1_first_name
      : event.groom2_role === 'bride'
        ? event.groom2_first_name
        : event.groom1_first_name;
  const groomName =
    event.groom1_role === 'groom'
      ? event.groom1_first_name
      : event.groom2_role === 'groom'
        ? event.groom2_first_name
        : event.groom2_first_name;
  const welcomeTitle =
    brideName && groomName
      ? t('cd_welcome_prefix', { bride: brideName, groom: groomName })
      : event.couple_name || undefined;

  const weatherCity = event.venue_city || event.church_city || event.location;

  const countdownLabels = {
    countdown_intro: t('cd_countdown_intro'),
    days: t('cd_days'),
    hours: t('cd_hours'),
    minutes: t('cd_minutes'),
    seconds: t('cd_seconds'),
    enter_app: t('cd_enter_app'),
    ceremony_title: t('cd_ceremony_title'),
    ceremony_subtitle: t('cd_ceremony_subtitle'),
    reception_title: t('cd_reception_title'),
    reception_subtitle: t('cd_reception_subtitle'),
    ended_title: t('cd_ended_title'),
    ended_subtitle: t('cd_ended_subtitle'),
  };

  return (
    <>
      {showWidget && (
        <Countdown
          targetDate={event.date}
          coupleName={event.couple_name}
          welcomeTitle={welcomeTitle}
          time={ceremonyTime || undefined}
          ceremonyTime={ceremonyTime}
          receptionTime={receptionTime}
          ceremonyAddress={ceremonyAddress}
          receptionAddress={receptionAddress}
          labels={countdownLabels}
          backgroundImageMobile="/countdown-bg-mobile.webp"
          backgroundImageDesktop="/countdown-bg-desktop.webp"
          onEnter={() => { setShowCountdown(false); contentRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
        >
          <AddToCalendarMenu
            date={event.date}
            time={ceremonyTime || '11:00'}
            title={`Matrimonio ${event.couple_name}`}
            address={ceremonyAddress || undefined}
            note={`Cerimonia${receptionAddress ? ' - Ricevimento: ' + receptionAddress : ''}`}
            durationMinutes={receptionTime ? 480 : 120}
            size="sm"
            variant="outline"
          />
          <div className="mt-3 flex flex-col items-center gap-2">
            <WeatherWidget city={weatherCity} eventDate={event.date} />
          </div>
        </Countdown>
      )}

      {!showWidget && <div ref={contentRef}>
        <main className="max-w-7xl mx-auto p-4 space-y-4">
          {/* Intestazione evento: nomi sposi + data/luogo + link mappa cerimonia/ricevimento */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand bg-brand/10 px-2 py-0.5 rounded mb-2">Ospiti</span>
              <h1 className="text-2xl font-bold">{event.couple_name}</h1>
              <p className="text-text-muted flex items-center gap-2 flex-wrap">
                <span>{new Date(event.date).toLocaleDateString()} — {event.location}</span>
                <span className="text-text-muted/60">·</span>
                <MiniCountdown
                  targetDate={event.date}
                  detailedWithinHours={24}
                  labels={{
                    days: t('cd_days'),
                    hours: t('cd_hours'),
                    minutes: t('cd_minutes'),
                    seconds: t('cd_seconds'),
                  }}
                />
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

          {/* ─── LAYOUT: sidebar azioni sx | feed centrale stile Facebook ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-4">
            {/* Sidebar SINISTRA — azioni per gli invitati */}
            <aside className="space-y-2 order-2 lg:order-1">
              <p className="text-xs uppercase tracking-wide text-text-muted px-1">{c('upload')}</p>
              {event.allow_guest_media === false
                ? null
                : canUpload
                  ? <Button variant="default" className="w-full justify-center" asChild><a href={`/events/${event.id}/upload`}>{c('upload')}</a></Button>
                  : <Button variant="default" className="w-full justify-center" disabled>{c('upload')} (finestra chiusa)</Button>}
              <Button variant="secondary" className="w-full justify-center" asChild><a href={`/events/${event.id}/games`}>{t('games')}</a></Button>
              <Button variant="outline" className="w-full justify-center" asChild><a href={`/events/${event.id}/games/jokes`}>{j('title')}</a></Button>
              <Button variant="outline" className="w-full justify-center" asChild><a href={`/events/${event.id}/guestbook`}>{t('guestbook')}</a></Button>
              <Button variant="outline" className="w-full justify-center" asChild><a href={`/event/${code}/music`}>{t('music')}</a></Button>
              <MiniMusicWidget eventId={event.id} href={`/event/${code}/music`} />
              <Button variant="outline" className="w-full justify-center" asChild><a href={`/e/${event.id}/capsule`}>Capsula del Tempo</a></Button>
            </aside>

            {/* COLONNA CENTRALE — feed timeline stile Facebook */}
            <section className="order-1 lg:order-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
                  <CardTitle>{c('gallery')} ({media.length + videos.length})</CardTitle>
                  {event.allow_guest_media === false ? null : (
                    <Button variant="default" size="sm" asChild>
                      <a href={`/events/${event.id}/upload`}>{c('upload')}</a>
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {media.length === 0 && videos.length === 0 ? (
                    <p className="text-text-muted">{c('no_results')}</p>
                  ) : (
                    <EventTimelineFeed
                      media={media}
                      videos={videos}
                      event={event}
                      eventId={event.id}
                      onShareMedia={handleShareMedia}
                      onOpenImage={(url) => setLightbox(url)}
                      showUploaderRoles={(event as { show_uploader_roles?: boolean }).show_uploader_roles !== false}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Sub-eventi (programma) */}
              {subEvents.length > 0 && (
                <Card className="mt-4">
                  <CardHeader><CardTitle>{t('subtitle')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {subEvents.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-2 rounded-md border border-border">
                          <div>
                            <p className="font-medium">{s.title}</p>
                            <p className="text-sm text-text-muted">{new Date(s.date).toLocaleDateString()}{s.location ? ` — ${s.location}` : ''}</p>
                          </div>
                          <Badge variant="outline">{s.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center gap-4 mt-4">
                <ShareButton
                  eventUrl={typeof globalThis !== 'undefined' ? globalThis.location?.href ?? '' : ''}
                  title={event.couple_name}
                />
              </div>
            </section>
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
