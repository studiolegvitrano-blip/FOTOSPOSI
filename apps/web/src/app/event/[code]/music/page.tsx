'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@fotosposi/core';
import { rememberLastEventCode } from '@/components/pwa-event-redirect';
import MusicPlaylist from '@/components/music-playlist';

export default function GuestEventMusicPage() {
  const params = useParams();
  const code = params.code as string;
  const c = useTranslations('common');
  const [eventId, setEventId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    getCurrentUser().then((u) => {
      const guestUser = u.user?.id
        ? {
            id: u.user.id,
            name: u.user.user_metadata?.full_name || u.user.user_metadata?.name || u.user.email || 'Ospite',
            email: u.user.email,
          }
        : undefined;
      fetch('/api/guest/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, guestUserId: guestUser?.id, guestName: guestUser?.name, guestEmail: guestUser?.email }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.event) {
            setError(data.error || 'Link non valido o scaduto');
            return;
          }
          setEventId(data.event.id);
          rememberLastEventCode(code);
        })
        .catch(() => {
          if (!cancelled) setError('Link non valido o scaduto');
        });
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <main className="max-w-lg mx-auto mt-8 p-4 text-center">
        <h1 className="text-xl font-bold">{error}</h1>
      </main>
    );
  }

  if (!eventId) return <p className="text-center mt-8">{c('loading')}</p>;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <Link
          href={`/event/${code}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-brand transition-colors no-underline"
        >
          <ArrowLeft className="w-4 h-4" /> {c('back_to_event')}
        </Link>
      </div>
      <MusicPlaylist eventId={eventId} />
    </div>
  );
}
