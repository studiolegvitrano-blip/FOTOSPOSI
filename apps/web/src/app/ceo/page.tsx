'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Loader2, LogOut, HardDrive, Database, Cloud, TrendingUp, Users, ShoppingCart,
  AlertTriangle, CheckCircle2, XCircle, Briefcase, FolderOpen, RefreshCw,
} from 'lucide-react';

interface CeoOverview {
  generatedAt: string;
  counts: { events: number; mediaTotal: number; ordersTotal: number };
  events: Array<{
    id: string;
    coupleName: string;
    date: string;
    location: string;
    tier: string;
    brand: string;
    createdAt: string;
    r2Folder: string;
    media: { total: number; photos: number; videos: number };
    drive: { synced: number; pending: number; failed: number; noStatus: number; withFileId: number };
    storage: { bytes: number; objects: number };
    r2: { missingInR2: Array<{ id: string; r2Key: string }> };
  }>;
  storage: {
    r2: { totalObjects: number; totalBytes: number; eventsObjects: number; eventsBytes: number; originalsObjects: number; originalsBytes: number; truncated: boolean; error?: string };
    supabase: { totalBytes: number; tables: Array<{ table_name: string; total_bytes: number; human_size: string }> };
    vercelEstimate: { note: string };
  };
  economic: {
    orders: { total: number; byStatus: Record<string, number>; paidRevenueCents: number; paidRevenueByCurrency: Record<string, number> };
    estimated: { eventsByTier: Record<string, number>; estimatedRevenueCents: number };
  };
  integrity: { mediaMissingInR2: number; r2OrphanObjects: string[]; r2OrphanCount: number };
}

const fmtBytes = (n: number): string => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
};

const fmtEur = (cents: number): string =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const TIER_COLOR: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  premium: 'default',
  deluxe: 'destructive',
  free: 'secondary',
};

export default function CeoDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<CeoOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ceo/overview', { cache: 'no-store' });
      if (res.status === 401) { router.replace('/ceo/login'); return; }
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Errore di caricamento');
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di caricamento');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const logout = async () => {
    await fetch('/api/ceo/logout', { method: 'POST' });
    router.replace('/ceo/login');
  };

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-brand" />
    </main>
  );

  if (error) return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-error">{error}</p>
    </main>
  );

  if (!data) return null;

  const { storage, economic, integrity, events, counts } = data;

  return (
    <main className="max-w-7xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-brand" /> Console CEO
          </h1>
          <p className="text-sm text-text-muted">
            Gestione piattaforma · aggiornato {new Date(data.generatedAt).toLocaleString('it-IT')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Aggiorna</Button>
          <Button variant="outline" size="sm" asChild><Link href="/admin">Console admin</Link></Button>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-2" /> Esci</Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle className="text-3xl text-center text-brand">{counts.events}</CardTitle></CardHeader><CardContent className="text-center text-sm text-text-muted"><Users className="inline w-4 h-4 mr-1" />Eventi</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-3xl text-center text-brand">{counts.mediaTotal}</CardTitle></CardHeader><CardContent className="text-center text-sm text-text-muted"><Cloud className="inline w-4 h-4 mr-1" />Media caricati</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-3xl text-center text-brand">{counts.ordersTotal}</CardTitle></CardHeader><CardContent className="text-center text-sm text-text-muted"><ShoppingCart className="inline w-4 h-4 mr-1" />Ordini</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-3xl text-center text-brand">{fmtBytes(storage.r2.totalBytes)}</CardTitle></CardHeader><CardContent className="text-center text-sm text-text-muted"><HardDrive className="inline w-4 h-4 mr-1" />Storage R2</CardContent></Card>
      </div>

      {/* Storage */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cloud className="w-4 h-4 text-brand" /> R2 (file)</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Oggetti totali</span><span className="font-medium">{storage.r2.totalObjects}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Dimensione totale</span><span className="font-medium">{fmtBytes(storage.r2.totalBytes)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">events/</span><span className="font-medium">{storage.r2.eventsObjects} · {fmtBytes(storage.r2.eventsBytes)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">originals/</span><span className="font-medium">{storage.r2.originalsObjects} · {fmtBytes(storage.r2.originalsBytes)}</span></div>
            {storage.r2.truncated && <p className="text-xs text-warning">Lista troncata (oltre 200k oggetti)</p>}
            {storage.r2.error && <p className="text-xs text-error">Errore listing: {storage.r2.error}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4 text-brand" /> Supabase</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Dimensione tabelle</span><span className="font-medium">{fmtBytes(storage.supabase.totalBytes)}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Tabelle</span><span className="font-medium">{storage.supabase.tables.length}</span></div>
            <details className="text-xs mt-2">
              <summary className="cursor-pointer text-brand">Dettaglio per tabella</summary>
              <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {storage.supabase.tables
                  .slice()
                  .sort((a, b) => b.total_bytes - a.total_bytes)
                  .map((t) => (
                    <div key={t.table_name} className="flex justify-between">
                      <span className="text-text-muted truncate">{t.table_name}</span>
                      <span className="font-medium">{t.human_size}</span>
                    </div>
                  ))}
              </div>
            </details>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><HardDrive className="w-4 h-4 text-brand" /> Vercel</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className="text-text-muted">{storage.vercelEstimate.note}</p>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-text-muted">Memoria derivata (media+queue)</span><span className="font-medium">{fmtBytes(storage.r2.totalBytes)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Economico */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand" /> Economico & finanziario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-border rounded-md p-3">
              <p className="text-xs text-text-muted uppercase tracking-wide">Ordini totali</p>
              <p className="text-2xl font-bold">{economic.orders.total}</p>
            </div>
            <div className="border border-border rounded-md p-3">
              <p className="text-xs text-text-muted uppercase tracking-wide">Ricavi pagati (ordini)</p>
              <p className="text-2xl font-bold">{fmtEur(economic.orders.paidRevenueCents)}</p>
              {Object.entries(economic.orders.paidRevenueByCurrency).map(([cur, c]) => (
                <p key={cur} className="text-xs text-text-muted">{cur}: {fmtEur(c)}</p>
              ))}
            </div>
            <div className="border border-border rounded-md p-3">
              <p className="text-xs text-text-muted uppercase tracking-wide">Ricavi stimati (tier, senza ordine)</p>
              <p className="text-2xl font-bold">{fmtEur(economic.estimated.estimatedRevenueCents)}</p>
              <p className="text-xs text-text-muted">
                {Object.entries(economic.estimated.eventsByTier).map(([t, n]) => `${t}: ${n}`).join(' · ')}
              </p>
            </div>
          </div>
          {Object.keys(economic.orders.byStatus).length > 0 && (
            <p className="text-sm text-text-muted">
              Per stato: {Object.entries(economic.orders.byStatus).map(([s, n]) => `${s} (${n})`).join(' · ')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Integrità R2 */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-brand" /> Integrità storage</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {integrity.mediaMissingInR2 === 0
              ? <CheckCircle2 className="w-5 h-5 text-success" />
              : <XCircle className="w-5 h-5 text-error" />}
            <span>
              {integrity.mediaMissingInR2 === 0
                ? 'Tutti i media in DB hanno il file su R2'
                : <strong className="text-error">{integrity.mediaMissingInR2} media hanno r2_key ma il file risulta CANCELLATO da R2</strong>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {integrity.r2OrphanCount === 0
              ? <CheckCircle2 className="w-5 h-5 text-success" />
              : <AlertTriangle className="w-5 h-5 text-warning" />}
            <span>
              {integrity.r2OrphanCount === 0
                ? 'Nessun oggetto orfano su R2 (tutti mappati in media_uploads)'
                : <span>{integrity.r2OrphanCount} oggetti su R2 senza record in media_uploads (orfani) — elenco: <code className="text-xs">{integrity.r2OrphanObjects.join(', ').slice(0, 400)}</code></span>}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Rubrica eventi */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><FolderOpen className="w-4 h-4 text-brand" /> Rubrica eventi ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sposi</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Memoria R2</TableHead>
                <TableHead>Drive sync</TableHead>
                <TableHead>Integrità</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <p className="font-medium">{e.coupleName}</p>
                    <p className="text-xs text-text-muted">{e.location}</p>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(e.date).toLocaleDateString('it-IT')}</TableCell>
                  <TableCell><Badge variant={TIER_COLOR[e.tier] ?? 'secondary'}>{e.tier}</Badge></TableCell>
                  <TableCell className="text-sm">{e.media.photos} 📷 · {e.media.videos} 🎬</TableCell>
                  <TableCell className="text-sm">
                    {fmtBytes(e.storage.bytes)}
                    <span className="block text-xs text-text-muted">{e.storage.objects} oggetti</span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className={e.drive.synced > 0 ? 'text-success' : 'text-text-muted'}>
                      {e.drive.synced} synced
                    </span>
                    {e.drive.pending > 0 && <span className="block text-warning">{e.drive.pending} pending</span>}
                    {e.drive.failed > 0 && <span className="block text-error">{e.drive.failed} failed</span>}
                    {e.drive.noStatus > 0 && <span className="block text-text-muted">{e.drive.noStatus} senza stato</span>}
                  </TableCell>
                  <TableCell>
                    {e.r2.missingInR2.length === 0
                      ? <span className="text-success text-xs">OK</span>
                      : <span className="text-error text-xs font-medium">{e.r2.missingInR2.length} mancanti</span>}
                  </TableCell>
                  <TableCell>
                    <Button variant="link" size="sm" asChild><Link href={`/events/${e.id}`}>Vedi</Link></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
