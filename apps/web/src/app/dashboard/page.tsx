'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, signOut } from '@fotosposi/core';
import { getEventsByUser } from '@fotosposi/events';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

  if (loading) return <p>Caricamento...</p>;

  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Dashboard FotoSposi</h1>
        <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Esci
        </button>
      </div>
      <p>Benvenuto, {user?.user_metadata?.name || user?.email}!</p>

      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>I tuoi eventi</h2>
          <Link href="/events/new" style={{ padding: '0.5rem 1rem', background: '#d4a574', color: '#fff', textDecoration: 'none', borderRadius: 6 }}>
            + Nuovo evento
          </Link>
        </div>
        {events.length === 0 ? (
          <p style={{ color: '#666' }}>Ancora nessun evento. Creane uno nuovo per iniziare.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {events.map((e) => (
              <li key={e.id} style={{ marginBottom: '0.5rem' }}>
                <Link href={`/events/${e.id}`} style={{ color: '#1a1a2e', textDecoration: 'none', fontWeight: 500 }}>
                  {e.couple_name} — {new Date(e.date).toLocaleDateString('it-IT')}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
