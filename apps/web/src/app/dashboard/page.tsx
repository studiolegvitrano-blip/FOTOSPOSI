'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, signOut } from '@fotosposi/core';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) {
        router.push('/login');
      } else {
        setUser(u);
      }
      setLoading(false);
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
        <h2>I tuoi eventi</h2>
        <p style={{ color: '#666' }}>Ancora nessun evento. Creane uno nuovo per iniziare.</p>
      </div>
    </main>
  );
}
