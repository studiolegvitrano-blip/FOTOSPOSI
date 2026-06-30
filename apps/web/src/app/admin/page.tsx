'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, signOut } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

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
      Promise.all([
        supabase.from('events').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('core_users').select('*').limit(50),
      ]).then(([eventsRes, usersRes]) => {
        if (eventsRes.data) setEvents(eventsRes.data);
        if (usersRes.data) setUsers(usersRes.data);
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
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pannello di gestione</h1>
          <p className="text-text-muted text-sm">Area riservata a wedding planner, fotografi e amministratori</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/admin/analytics">Analytics</Link></Button>
          <Button variant="outline" asChild><Link href="/marketplace">Fornitori</Link></Button>
          <Button variant="outline" asChild><Link href="/dashboard">Dashboard</Link></Button>
          <Button variant="ghost" onClick={handleLogout}>Esci</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-brand">{events.length}</CardTitle></CardHeader>
          <CardContent className="text-center text-text-muted">Eventi totali</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-brand">{users.length}</CardTitle></CardHeader>
          <CardContent className="text-center text-text-muted">Utenti</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Eventi recenti</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sposi</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Luogo</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.couple_name}</TableCell>
                  <TableCell>{new Date(e.date).toLocaleDateString('it-IT')}</TableCell>
                  <TableCell className="text-text-muted">{e.location}</TableCell>
                  <TableCell><Badge variant={e.tier === 'premium' ? 'default' : 'secondary'}>{e.tier}</Badge></TableCell>
                  <TableCell><Button variant="link" size="sm" asChild><Link href={`/events/${e.id}`}>Vedi</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Utenti</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Ruolo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-text-muted">{u.email}</TableCell>
                  <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
