import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const dynamic = 'force-dynamic';

interface AdminEvent {
  id: string;
  couple_name: string;
  date: string;
  location: string;
  tier: string;
  brand: string;
  created_at: string;
}

interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  email: string;
  role: string;
  role_at_event: string | null;
  created_at: string;
}

interface AdminOverview {
  events: AdminEvent[];
  users: AdminUser[];
  counts: { events: number; users: number };
  generatedAt: string;
}

async function loadOverview(cookieHeader: string): Promise<{ data?: AdminOverview; error?: string }> {
  const base = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/admin/overview`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.error ?? `Errore ${res.status}` };
    }
    const json = (await res.json()) as AdminOverview;
    return { data: json };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore rete' };
  }
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const token = ceoTokenFromCookies(cookieHeader);

  if (!verifyCeoSession(token)) {
    redirect('/ceo/login?redirect=/admin');
  }

  const { data, error } = await loadOverview(cookieHeader);

  if (error) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pannello di gestione</h1>
          <Button variant="outline" asChild><Link href="/dashboard">Dashboard</Link></Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <Button className="mt-4" variant="outline" asChild><Link href="/admin">Riprova</Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const events = data?.events ?? [];
  const users = data?.users ?? [];
  const eventsCount = data?.counts?.events ?? events.length;
  const usersCount = data?.counts?.users ?? users.length;

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pannello di gestione</h1>
          <p className="text-text-muted text-sm">Area riservata a wedding planner, fotografi e amministratori</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/admin/coupons">Coupon</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/affiliates">Collaboratori</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/analytics">Analytics</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/marketplace">Fornitori</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/leads">Lead B2B</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/system">Sistema</Link></Button>
          <Button variant="outline" asChild><Link href="/dashboard">Dashboard</Link></Button>
          <form action="/api/ceo/logout" method="POST" style={{ display: 'inline' }}>
            <Button type="submit" variant="ghost">Esci</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-brand">{eventsCount}</CardTitle></CardHeader>
          <CardContent className="text-center text-text-muted">Eventi totali</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-brand">{usersCount}</CardTitle></CardHeader>
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
                <TableHead>Brand</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.couple_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{new Date(e.date).toLocaleDateString('it-IT')}</TableCell>
                  <TableCell className="text-text-muted">{e.location}</TableCell>
                  <TableCell><Badge variant={e.tier === 'premium' || e.tier === 'deluxe' ? 'default' : 'secondary'}>{e.tier}</Badge></TableCell>
                  <TableCell className="text-text-muted">{e.brand}</TableCell>
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
                <TableHead>Ruolo all'evento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.name || '—';
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-text-muted">{u.email}</TableCell>
                    <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                    <TableCell className="text-text-muted">{u.role_at_event ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
