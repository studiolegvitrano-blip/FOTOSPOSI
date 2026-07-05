'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient, signOut } from '@fotosposi/core';
import { getAllSuppliers, approveSupplier, deleteSupplier, getAvgRating } from '@fotosposi/marketplace';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function AdminMarketplacePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getAllSuppliers();
    if (r.suppliers) {
      const withRatings = await Promise.all(
        r.suppliers.map(async (s) => {
          const r2 = await getAvgRating(s.id);
          return { ...s, avgRating: r2.avg, reviewCount: r2.count };
        }),
      );
      setSuppliers(withRatings);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
      setUser(u);
      load().then(() => setLoading(false));
    });
  }, [router, load]);

  const handleApprove = async (id: string, approved: boolean) => {
    setActionLoading(id);
    await approveSupplier(id, approved);
    await load();
    setActionLoading(null);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Eliminare definitivamente "${name}"?`)) return;
    setActionLoading(id);
    await deleteSupplier(id);
    await load();
    setActionLoading(null);
  };

  const handleLogout = async () => {
    await signOut();
    router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
  };

  const total = suppliers.length;
  const pending = suppliers.filter((s) => !s.approved).length;
  const approved = suppliers.filter((s) => s.approved).length;

  if (loading) return <p className="text-center mt-8">Caricamento...</p>;

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestione fornitori</h1>
          <p className="text-text-muted text-sm">Approva, modifica o rimuovi fornitori dal marketplace</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/admin">Admin</Link></Button>
          <Button variant="outline" asChild><Link href="/admin/analytics">Analytics</Link></Button>
          <Button variant="outline" asChild><Link href="/marketplace">Vetrina pubblica</Link></Button>
          <Button variant="ghost" onClick={handleLogout}>Esci</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-brand">{total}</CardTitle></CardHeader>
          <CardContent className="text-center text-text-muted">Fornitori totali</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-amber-500">{pending}</CardTitle></CardHeader>
          <CardContent className="text-center text-text-muted">In attesa di approvazione</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-3xl text-center text-green-600">{approved}</CardTitle></CardHeader>
          <CardContent className="text-center text-text-muted">Approvati</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Elenco fornitori</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Città</TableHead>
                <TableHead>Valutazione</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-text-muted py-8">Nessun fornitore</TableCell>
                </TableRow>
              ) : suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{s.category}</Badge></TableCell>
                  <TableCell className="text-text-muted">{s.city || '-'}</TableCell>
                  <TableCell>{s.reviewCount > 0 ? `${'★'.repeat(Math.round(s.avgRating))} (${s.reviewCount})` : '-'}</TableCell>
                  <TableCell>
                    {s.approved
                      ? <Badge variant="default" className="bg-green-600">Approvato</Badge>
                      : <Badge variant="secondary">In attesa</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {!s.approved ? (
                        <Button size="sm" variant="default" disabled={actionLoading === s.id} onClick={() => handleApprove(s.id, true)}>
                          Approva
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={actionLoading === s.id} onClick={() => handleApprove(s.id, false)}>
                          Revoca
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" disabled={actionLoading === s.id} onClick={() => handleDelete(s.id, s.name)}>
                        Elimina
                      </Button>
                    </div>
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
