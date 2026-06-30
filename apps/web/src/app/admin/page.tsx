'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@fotosposi/core';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.push('/login'); return; }
      setUser(u);
      loadAllEvents();
      loadAllUsers();
    });
  }, [router]);

  const loadAllEvents = () => {
    const supabase = createClient();
    supabase.from('events').select('*').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setEvents(data); setLoading(false); });
  };

  const loadAllUsers = () => {
    const supabase = createClient();
    supabase.from('core_users').select('*').limit(50)
      .then(({ data }) => { if (data) setUsers(data); });
  };

  if (loading) return <p>Caricamento...</p>;

  return (
    <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Pannello di gestione</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Area riservata a wedding planner, fotografi e amministratori</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', background: '#f5f5f5', borderRadius: 8, textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d4a574' }}>{events.length}</p>
          <p>Eventi totali</p>
        </div>
        <div style={{ padding: '1.5rem', background: '#f5f5f5', borderRadius: 8, textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d4a574' }}>{users.length}</p>
          <p>Utenti</p>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Eventi recenti</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Sposi</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Data</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Luogo</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Piano</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{e.couple_name}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{new Date(e.date).toLocaleDateString('it-IT')}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{e.location}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{e.tier}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                    <Link href={`/events/${e.id}`} style={{ color: '#d4a574' }}>Vedi</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 style={{ marginBottom: '1rem' }}>Utenti</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Nome</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Email</th>
                <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Ruolo</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{u.name}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{u.email}</td>
                  <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
