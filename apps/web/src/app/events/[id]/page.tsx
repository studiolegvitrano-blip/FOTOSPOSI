'use client';

import { useEffect, useState, useRef } from 'react';
import { hasFeature, type Tier } from '@fotosposi/core';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ShareButton, Countdown, MiniCountdown } from '@fotosposi/ui';
import { shareWatermarkedMedia } from '@/lib/share-watermarked';
import { Share2, Church, Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AddToCalendarMenu } from '@/components/add-to-calendar-menu';
import WeatherWidget from '@/components/weather-widget';
import type { WeddingEvent, SubEvent, EventWindow } from '@fotosposi/events';
import type { MediaUpload } from '@fotosposi/media';
import EventTimelineFeed from '@/components/event-timeline-feed';
import FullGalleryLightbox from '@/components/full-gallery-lightbox';
import MiniMusicWidget from '@/components/mini-music-widget';

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
  const [showCountdown, setShowCountdown] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [ceremonyTime, setCeremonyTime] = useState<string | undefined>();
  const [receptionTime, setReceptionTime] = useState<string | undefined>();
  const [partner, setPartner] = useState<{ name: string; logo_url?: string | null; claim_text?: string | null; address?: string | null; website?: string | null; social_handle?: string | null; social_hashtag?: string | null } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Il countdown appare al max 1 volta al giorno per evento: il timestamp dell'ultima
  // visualizzazione è salvato in localStorage. Al refresh/ritorno sulla pagina viene
  // mostrato di nuovo solo se non è già stato visto oggi.
  useEffect(() => {
    if (!eventId) return;
    try {
      const key = `fotosposi-countdown-${eventId}`;
      const last = Number(localStorage.getItem(key) || '0');
      const today = new Date().toDateString();
      if (last && new Date(last).toDateString() === today) {
        setShowCountdown(false);
        return;
      }
      localStorage.setItem(key, String(Date.now()));
      setShowCountdown(true);
    } catch {
      setShowCountdown(true);
    }
  }, [eventId]);

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
        // canManage = sposo (creator) OR delegato (event_managers edit/admin).
        // Restituito da /api/events/[id]/details a partire dal 31/07/2026.
        setCanManage(d.canManage ?? d.isCreator ?? false);
      }
      // Orari cerimonia/ricevimento dal SiteContent pubblicato (site-builder), passati
      // dalla route details (01/08/2026). Se assenti → fallback 11:00/13:00 nel Countdown.
      if (typeof d.ceremonyTime === 'string') setCeremonyTime(d.ceremonyTime);
      if (typeof d.receptionTime === 'string') setReceptionTime(d.receptionTime);
      if (d.subEvents) setSubEvents(d.subEvents);
      if (d.window) setEvtWindow(d.window);
      if (d.partner) setPartner(d.partner);
      if (m.media) setMedia(m.media);
      if (m.videoMessages) setVideos(m.videoMessages);
      setLoading(false);
    });
  }, [eventId]);

  if (loading) return <p className="text-center mt-8">{c('loading')}</p>;
  if (!event) return <p className="text-center mt-8">{c('no_results')}</p>;

  const tier = (event.tier || 'free') as Tier;
  const showWidget = showCountdown && hasFeature(tier, 'countdown_widget');

  // Orari cerimonia/ricevimento: arrivano dal SiteContent (site-builder) via
  // /api/events/[id]/details. Fallback 11:00/13:00 solo se il draft non li ha
  // (niente migration DB — decisione 31/07/2026). Rispettano eventi serali.
  const ceremonyAddress = [event.church, event.church_address, event.church_city || event.location]
    .filter(Boolean)
    .join(', ');
  const receptionAddress = [event.venue, event.venue_address, event.venue_city || event.location]
    .filter(Boolean)
    .join(', ');
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

  // Titolo di benvenuto: "Benvenuti al Matrimonio di <sposa> e <sposo>".
  // Sposa prima, poi sposo (groom1/groom2 possono essere sposo O sposa — migration 00038).
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

  // Città per il widget meteo: priorità alle città specifiche di cerimonia/ricevimento,
  // fallback al comune generico dell'evento. Il widget usa Open-Meteo e appare solo
  // da 3 giorni prima dell'evento — nessun input extra per gli sposi.
  const weatherCity = event.venue_city || event.church_city || event.location;

  // Logo brand per la fase ended del countdown (mostrato sotto il messaggio di ringraziamento).
  const brandLogoUrl = event.brand === 'weddingmoments'
    ? '/logo-justmarry-trans.png'
    : '/logo-sposi-trans.png';

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
          brandLogoDataUri={brandLogoUrl}
          brandLogoAlt={event.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live'}
          partnerLogoUrl={partner?.logo_url ?? null}
          partnerName={partner?.name ?? null}
          partnerClaimText={partner?.claim_text ?? null}
          partnerAddress={partner?.address ?? null}
          partnerWebsite={partner?.website ?? null}
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
          {/* Intestazione evento: full-width sopra le 3 colonne */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand bg-brand/10 px-2 py-0.5 rounded mb-2">Sposi</span>
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
              <Button variant="outline" className="w-full justify-center" asChild><Link href={`/events/${eventId}/music`}>{t('music')}</Link></Button>
              <MiniMusicWidget eventId={eventId} href={`/events/${eventId}/music`} />
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
                      canManage={canManage}
                      shareProps={{
                        groom1Handle: event.groom1_social_handle ?? null,
                        groom2Handle: event.groom2_social_handle ?? null,
                        coupleHashtag: event.couple_hashtag ?? null,
                        partnerHandle: partner?.social_handle ?? null,
                        partnerHashtag: partner?.social_hashtag ?? null,
                        brand: event.brand === 'weddingmoments' ? 'justmarry' : 'sposilive',
                      }}
                      onDeleteMedia={async (postId: string) => {
                        // Cancella foto via API DELETE /api/media/[id]. Solo sposo/delegato vede
                        // il bottone (canManage=true), e solo lui arriva qui. La route autorizza
                        // comunque via JWT + check su events.created_by / event_managers.
                        const res = await fetch(`/api/media/${postId}`, { method: 'DELETE' });
                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          alert(data.error || 'Errore durante la cancellazione');
                          return;
                        }
                        // Aggiorna la galleria rimuovendo la foto cancellata dallo state locale
                        // (niente overhead di refetch — lo stato è già in memoria).
                        setMedia((prev) => prev.filter((m) => m.id !== postId));
                        setVideos((prev) => prev.filter((v) => v.id !== postId));
                      }}
                      onShareMedia={(id, isVideo) => {
                        const brand = typeof window !== 'undefined' && window.location.hostname.includes('justmarry')
                          ? 'JustMarry.live'
                          : 'Sposi.live';
                        shareWatermarkedMedia(id, eventId, isVideo, `${event?.couple_name} — ${brand}`);
                      }}
                      onOpenImage={(url) => setLightbox(url)}
                      showUploaderRoles={(event as { show_uploader_roles?: boolean }).show_uploader_roles !== false}
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
                <Button variant="outline" className="w-full justify-start" asChild><Link href={`/events/${eventId}/invitations`}>Lista invitati</Link></Button>
                <Button variant="outline" className="w-full justify-start" asChild><Link href={`/events/${eventId}/rsvp`}>Conferme RSVP</Link></Button>
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
        shareProps={{
          groom1Handle: event?.groom1_social_handle ?? null,
          groom2Handle: event?.groom2_social_handle ?? null,
          coupleHashtag: event?.couple_hashtag ?? null,
          partnerHandle: partner?.social_handle ?? null,
          partnerHashtag: partner?.social_hashtag ?? null,
          brand: event?.brand === 'weddingmoments' ? 'justmarry' : 'sposilive',
        }}
      />
    </>
  );
}
