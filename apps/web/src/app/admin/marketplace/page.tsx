'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient, signOut } from '@fotosposi/core';
import { getAllSuppliers, approveSupplier, deleteSupplier, getAvgRating } from '@fotosposi/marketplace';
import type { MarketplaceSupplier } from '@fotosposi/marketplace';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

type Filter = 'all' | 'pending' | 'approved' | 'public_form';

type SupplierWithRating = MarketplaceSupplier & {
  avgRating: number;
  reviewCount: number;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatPricing(n: number | null): string {
  if (n === null || n === undefined) return '-';
  return `da € ${n.toFixed(2)}`;
}

export default function AdminMarketplacePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<SupplierWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await getAllSuppliers();
    if (r.suppliers) {
      const withRatings = await Promise.all(
        r.suppliers.map(async (s) => {
          const r2 = await getAvgRating(s.id);
          return { ...s, avgRating: r2.avg, reviewCount: r2.count } as SupplierWithRating;
        }),
      );
      setSuppliers(withRatings);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
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
  const publicForms = suppliers.filter((s) => s.submission_source === 'public_form').length;

  const filtered = useMemo(() => {
    switch (filter) {
      case 'pending':
        return suppliers.filter((s) => !s.approved);
      case 'approved':
        return suppliers.filter((s) => s.approved);
      case 'public_form':
        return suppliers.filter((s) => s.submission_source === 'public_form');
      default:
        return suppliers;
    }
  }, [suppliers, filter]);

  if (loading) return <p className="text-center mt-8">Caricamento...</p>;

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Gestione fornitori</h1>
          <p className="text-text-muted text-sm">
            Approva, modifica o rimuovi fornitori dal marketplace. Le candidature dal form /collaboratori
            (sorgente "public_form") includono tutti i campi del submit.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href="/admin">Admin</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/analytics">Analytics</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/marketplace">Vetrina pubblica</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/ceo">CEO</Link>
          </Button>
          <Button variant="ghost" onClick={handleLogout}>
            Esci
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-center text-brand">{total}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-text-muted text-sm">Fornitori totali</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-center text-amber-500">{pending}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-text-muted text-sm">In attesa</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-center text-green-600">{approved}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-text-muted text-sm">Approvati</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl text-center text-blue-600">{publicForms}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-text-muted text-sm">Candidature pubbliche</CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
          Tutti ({total})
        </Button>
        <Button
          size="sm"
          variant={filter === 'pending' ? 'default' : 'outline'}
          onClick={() => setFilter('pending')}
        >
          In attesa ({pending})
        </Button>
        <Button
          size="sm"
          variant={filter === 'approved' ? 'default' : 'outline'}
          onClick={() => setFilter('approved')}
        >
          Approvati ({approved})
        </Button>
        <Button
          size="sm"
          variant={filter === 'public_form' ? 'default' : 'outline'}
          onClick={() => setFilter('public_form')}
        >
          Candidature pubbliche ({publicForms})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco fornitori ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Azienda</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Città</TableHead>
                <TableHead>Sorgente</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Valut.</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-text-muted py-8">
                    Nessun fornitore per questo filtro
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => {
                  const isExpanded = expandedId === s.id;
                  const isPublic = s.submission_source === 'public_form';
                  const displayName =
                    s.business_name || s.full_name || s.name || ('—');
                  return (
                    <>
                      <TableRow
                        key={s.id}
                        className={isPublic ? 'cursor-pointer' : ''}
                        onClick={isPublic ? () => setExpandedId(isExpanded ? null : s.id) : undefined}
                      >
                        <TableCell className="font-medium">
                          <div>{displayName}</div>
                          {s.business_name && s.full_name && (
                            <div className="text-xs text-text-muted">{s.full_name}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.account_type === 'commerciale' ? (
                            <Badge variant="secondary">Azienda</Badge>
                          ) : (
                            <Badge variant="outline">Privato</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {s.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-text-muted">{s.city || '-'}</TableCell>
                        <TableCell>
                          {isPublic ? (
                            <Badge variant="default" className="bg-blue-600">
                              Form /collaboratori
                            </Badge>
                          ) : (
                            <Badge variant="outline">manuale</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.approved ? (
                            <Badge variant="default" className="bg-green-600">
                              Approvato
                            </Badge>
                          ) : (
                            <Badge variant="secondary">In attesa</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.reviewCount > 0
                            ? `${'★'.repeat(Math.round(s.avgRating))} (${s.reviewCount})`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            {!s.approved ? (
                              <Button
                                size="sm"
                                variant="default"
                                disabled={actionLoading === s.id}
                                onClick={() => handleApprove(s.id, true)}
                              >
                                Approva
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionLoading === s.id}
                                onClick={() => handleApprove(s.id, false)}
                              >
                                Revoca
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={actionLoading === s.id}
                              onClick={() => handleDelete(s.id, displayName)}
                            >
                              Elimina
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && isPublic && (
                        <TableRow key={`${s.id}-detail`}>
                          <TableCell colSpan={8} className="bg-muted/30 p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                              <DetailField label="Account type">
                                {s.account_type === 'commerciale' ? 'Azienda / Partita IVA' : 'Privato / Freelance'}
                              </DetailField>
                              <DetailField label="Nome completo">{s.full_name || '-'}</DetailField>
                              <DetailField label="Ragione sociale">{s.business_name || '-'}</DetailField>
                              <DetailField label="Email">{s.email || '-'}</DetailField>
                              <DetailField label="Telefono">{s.phone || '-'}</DetailField>
                              <DetailField label="Indirizzo">{s.address || '-'}</DetailField>
                              <DetailField label="Partita IVA">
                                {s.account_type === 'commerciale' ? s.vat_number || '-' : <span className="text-text-muted italic">non richiesto per privato</span>}
                              </DetailField>
                              <DetailField label="Città">{s.city || '-'}</DetailField>
                              <DetailField label="Regione">{s.region || '-'}</DetailField>
                              <DetailField label="Paese">{s.country || '-'}</DetailField>
                              <DetailField label="Website">
                                {s.website ? (
                                  <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                    {s.website}
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </DetailField>
                              <DetailField label="Instagram">
                                {s.instagram ? (
                                  <a
                                    href={`https://instagram.com/${s.instagram.replace(/^@/, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 underline"
                                  >
                                    @{s.instagram.replace(/^@/, '')}
                                  </a>
                                ) : (
                                  '-'
                                )}
                              </DetailField>
                              <DetailField label="Anni esperienza">{s.years_experience ?? '-'}</DetailField>
                              <DetailField label="Prezzo da">{formatPricing(s.pricing_from)}</DetailField>
                              <DetailField label="Consenso marketing">
                                {s.marketing_consent ? 'Sì' : 'No'}
                              </DetailField>
                              <DetailField label="Termini accettati">
                                {s.agreed_terms ? 'Sì' : 'No'}
                              </DetailField>
                              <DetailField label="Sorgente">{s.submission_source}</DetailField>
                              <DetailField label="Inviata il">{formatDate(s.submitted_at)}</DetailField>
                              <DetailField label="Creata il">{formatDate(s.created_at)}</DetailField>
                              <div className="md:col-span-2 lg:col-span-3">
                                <div className="text-text-muted text-xs uppercase tracking-wide mb-1">Descrizione</div>
                                <div className="whitespace-pre-wrap">
                                  {s.description || <span className="text-text-muted italic">nessuna</span>}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-text-muted text-xs uppercase tracking-wide mb-0.5">{label}</div>
      <div>{children}</div>
    </div>
  );
}
