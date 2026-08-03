'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, signOut } from '@fotosposi/core';
import { getEventsByUser } from '@fotosposi/events';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { User } from '@supabase/supabase-js';
import type { WeddingEvent } from '@fotosposi/events';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const c = useTranslations('common');
  const n = useTranslations('nav');
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<WeddingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
      setUser(u);
      getEventsByUser(u.id).then((r) => {
        if (r.events) setEvents(r.events);
        setLoading(false);
      });
    });
  }, [router]);

  const handleLogout = async () => {
    await signOut();
    router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  };

  if (loading) return <p className="text-center mt-8">{c('loading')}</p>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-text-muted text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Button variant="outline" asChild><Link href="/marketplace">{n('marketplace')}</Link></Button>
          <Button variant="ghost" asChild><Link href="/ceo">CEO</Link></Button>
          <Button variant="ghost" onClick={handleLogout}>{n('logout')}</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('title')}</CardTitle>
          <Button asChild><Link href="/events/new">{t('create_event')}</Link></Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-text-muted">{t('no_events')}</p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={`/events/${e.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors no-underline text-text"
                >
                  <div>
                    <p className="font-medium">{e.couple_name}</p>
                    <p className="text-sm text-text-muted">{new Date(e.date).toLocaleDateString()}</p>
                  </div>
                  <Badge variant={e.tier === 'premium' ? 'default' : 'secondary'}>{e.tier}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
