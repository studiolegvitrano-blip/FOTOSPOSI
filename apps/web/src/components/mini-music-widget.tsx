'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Music } from 'lucide-react';

export default function MiniMusicWidget({
  eventId,
  href,
}: {
  eventId: string;
  href: string;
}) {
  const t = useTranslations('music');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/events/${eventId}/songs`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.songs)) setCount(d.songs.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text hover:border-brand transition-colors no-underline"
    >
      <Music className="w-4 h-4 text-brand" />
      <span className="font-medium">{t('title')}</span>
      {count !== null && (
        <span className="ml-auto text-xs text-text-muted tabular-nums">({count})</span>
      )}
    </Link>
  );
}
