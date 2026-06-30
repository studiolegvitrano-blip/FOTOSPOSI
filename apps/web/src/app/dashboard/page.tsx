'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, signOut } from '@fotosposi/core';
import { getEventsByUser } from '@fotosposi/events';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { User } from '@supabase/supabase-js';
import type { WeddingEvent } from '@fotosposi/events';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<WeddingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) {
        router.push('/login');
        return;
      }
      setUser(u);
      getEventsByUser(u.id).then((r) => {
        if (r.events) setEvents(r.events);
        setLoading(false);
      });
    });
  }, [router]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading) return <p className="text-center mt-8">Caricamento...</p>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-text-muted text-sm">Benvenuto, {user?.user_metadata?.name || user?.email}!</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/admin">Admin</Link></Button>
          <Button variant="ghost" onClick={handleLogout}>Esci</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>I tuoi eventi</CardTitle>
          <Button asChild><Link href="/events/new">+ Nuovo evento</Link></Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-text-muted">Ancora nessun evento. Creane uno nuovo per iniziare.</p>
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
                    <p className="text-sm text-text-muted">{new Date(e.date).toLocaleDateString('it-IT')}</p>
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
