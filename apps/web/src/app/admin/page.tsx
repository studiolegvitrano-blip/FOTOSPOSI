import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';
import { internalBaseUrl } from '@/lib/internal-base';

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

interface QueueHealth {
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  syncedCount: number;
  oldestPendingAt: string | null;
  stalePendingMinutes: number;
  pendingStalled: boolean;
  lastEventsSwept: number | null;
  prevEventsSwept: number | null;
  twoCyclesZeroSwept: boolean;
}

interface AdminOverview {
  events: AdminEvent[];
  users: AdminUser[];
  counts: { events: number; users: number };
  queueHealth?: QueueHealth;
  generatedAt: string;
}

async function loadOverview(cookieHeader: string): Promise<{ data?: AdminOverview; error?: string }> {
  const base = await internalBaseUrl();
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

  if (!(await verifyCeoSession(token))) {
    redirect('/ceo/login?redirect=/admin');
  }

  const { data, error } = await loadOverview(cookieHeader);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-4">
        <AdminSidebar />
        <main className="flex-1 min-w-0 space-y-6">
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
      </div>
    );
  }

  const events = data?.events ?? [];
  const users = data?.users ?? [];
  const eventsCount = data?.counts?.events ?? events.length;
  const usersCount = data?.counts?.users ?? users.length;
  const qh = data?.queueHealth;
  const showStallBanner = !!qh && (qh.pendingStalled || qh.twoCyclesZeroSwept);
  const stallReasons: string[] = [];
  if (qh?.pendingStalled) {
    stallReasons.push(
      `${qh.pendingCount} item in coda pending da ${qh.stalePendingMinutes} min (soglia 30 min)`,
    );
  }
  if (qh?.twoCyclesZeroSwept) {
    stallReasons.push(`cron maintenance con eventsSwept=0 per 2 cicli consecutivi`);
  }

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-4">
      <AdminSidebar />
      <main className="flex-1 min-w-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pannello di gestione</h1>
          <p className="text-text-muted text-sm">Area riservata a wedding planner, fotografi e amministratori</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/dashboard">Dashboard</Link></Button>
        </div>
      </div>

      {showStallBanner && (
        <div
          role="alert"
          className="rounded-md border border-red-500 bg-red-50 dark:bg-red-950/40 p-4 space-y-2"
        >
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold">
            <span aria-hidden>&#9888;</span>
            <span>Upload queue in stallo — intervento richiesto</span>
          </div>
          <ul className="text-sm text-red-700 dark:text-red-300 list-disc pl-5 space-y-1">
            {stallReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" asChild>
              <Link href="/admin/system">Vai a Sistema</Link>
            </Button>
            <Button variant="link" asChild>
              <Link href="/admin/system?refresh=1">Aggiorna stato</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-brand">{eventsCount}</CardTitle></CardHeader>
          <CardContent className="text-center text-text-muted">Eventi totali</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-brand">{usersCount}</CardTitle></CardHeader>
          <CardContent className="text-center text-text-muted">Utenti</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-center">
              <span className={qh && qh.pendingCount === 0 && qh.failedCount === 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
                {qh ? `${qh.pendingCount}/${qh.failedCount}` : '—'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center text-text-muted">
            Coda (pending/failed){showStallBanner ? ' — stallo' : ''}
          </CardContent>
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
    </div>
  );
}
