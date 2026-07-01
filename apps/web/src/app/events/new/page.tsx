'use client';

import { useState, useEffect } from 'react';
import { createEvent, getEventsByUser } from '@fotosposi/events';
import { getCurrentUser } from '@fotosposi/core';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export default function NewEventPage() {
  const [user, setUser] = useState<User | null>(null);
  const [coupleName, setCoupleName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [church, setChurch] = useState('');
  const [venue, setVenue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then(({ user: u }) => {
      if (!u) router.push('/login');
      else setUser(u);
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');

    const { event, error: err } = await createEvent({
      tenant_id: user.id,
      created_by: user.id,
      couple_name: coupleName,
      date,
      location,
      church: church || undefined,
      venue: venue || undefined,
      brand: 'fotosposi',
    });

    setLoading(false);
    if (err) {
      setError(err);
    } else if (event) {
      router.push(`/events/${event.id}`);
    }
  };

  return (
    <main style={{ maxWidth: 500, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Crea il tuo evento</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Nome degli sposi</label>
          <input
            type="text"
            value={coupleName}
            onChange={(e) => setCoupleName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Data del matrimonio</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Luogo (città)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Cerimonia</label>
          <input
            type="text"
            value={church}
            onChange={(e) => setChurch(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Ricevimento</label>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 2rem', fontSize: '1rem', cursor: 'pointer' }}>
          {loading ? 'Creazione...' : 'Crea evento'}
        </button>
      </form>
    </main>
  );
}
