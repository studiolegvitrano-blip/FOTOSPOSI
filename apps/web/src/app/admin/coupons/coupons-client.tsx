'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { Coupon } from '@fotosposi/commerce';

export default function CouponsClient({ initialCoupons }: { initialCoupons: Coupon[] }) {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const loadCoupons = async () => {
    const res = await fetch('/api/admin/coupons');
    const json = await res.json();
    if (json.data) setCoupons(json.data);
  };

  const handleCreate = async () => {
    if (!code || !discountValue) return;
    setLoading(true);
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        max_uses: maxUses ? parseInt(maxUses) : undefined,
        expires_at: expiresAt || undefined,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (json.error) { alert(json.error); return; }
    setShowForm(false);
    setCode(''); setDiscountValue(''); setMaxUses(''); setExpiresAt('');
    loadCoupons();
  };

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Coupon Sconto</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/admin">← Admin</Link></Button>
          <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Annulla' : '+ Nuovo Coupon'}</Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nuovo Coupon</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Codice</label>
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="w-full border rounded p-2 text-sm" placeholder="ES: WED2026" />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <select value={discountType} onChange={e => setDiscountType(e.target.value as any)} className="w-full border rounded p-2 text-sm">
                  <option value="percentage">Percentuale</option>
                  <option value="fixed">Importo fisso</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{discountType === 'percentage' ? 'Sconto %' : 'Importo €'}</label>
                <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="25" />
              </div>
              <div>
                <label className="text-sm font-medium">Max utilizzi (opz)</label>
                <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} className="w-full border rounded p-2 text-sm" placeholder="Illimitato" />
              </div>
              <div>
                <label className="text-sm font-medium">Scadenza (opz)</label>
                <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full border rounded p-2 text-sm" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={loading}>{loading ? 'Creazione...' : 'Crea Coupon'}</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Sconto</TableHead>
                <TableHead>Usi</TableHead>
                <TableHead>Scadenza</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono font-bold">{c.code}</TableCell>
                  <TableCell>{c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value}€`}</TableCell>
                  <TableCell>{c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : ''}</TableCell>
                  <TableCell className="text-text-muted">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('it-IT') : 'Mai'}</TableCell>
                  <TableCell><Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Attivo' : 'Spento'}</Badge></TableCell>
                </TableRow>
              ))}
              {coupons.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-text-muted">Nessun coupon</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
