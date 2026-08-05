'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import MusicPlaylist from '@/components/music-playlist';

export default function EventMusicPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('music');
  const c = useTranslations('common');

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <Link
          href={`/events/${id}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-brand transition-colors no-underline"
        >
          <ArrowLeft className="w-4 h-4" /> {c('back_to_event')}
        </Link>
      </div>
      <MusicPlaylist eventId={id} />
    </div>
  );
}
