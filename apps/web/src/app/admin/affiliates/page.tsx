'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@fotosposi/core';
import { listAffiliates, createAffiliate, getReferrals, calculateVolumePrice, type Affiliate, type Referral } from '@fotosposi/commerce';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function AdminAffiliatesPage() {
  const router = useRouter();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [commissionRate, setCommissionRate] = useState('10');
  const [couponCode, setCouponCode] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.push('/login'); return; }
      setUser(u);
      loadAffiliates();
    });
  }, [router]);

  const loadAffiliates = async () => {
    const { affiliates: a } = await listAffiliates();
    if (a) setAffiliates(a);
  };

  const handleCreate = async () => {
    if (!name || !email) return;
    const { affiliate, error } = await createAffiliate({
      name, email, role: role || undefined, company: company || undefined,
      commission_rate: parseFloat(commissionRate),
      coupon_code: couponCode.toUpperCase() || undefined,
      created_by: user?.id,
    });
    if (error) { alert(error); return; }
    setShowForm(false);
    setName(''); setEmail(''); setRole(''); setCompany(''); setCommissionRate('10'); setCouponCode('');
    loadAffiliates();
  };

  const viewReferrals = async (a: Affiliate) => {
    setSelectedAffiliate(a);
    const { referrals: r } = await getReferrals(a.id);
    if (r) setReferrals(r);
  };

  const vol = (qty: number) => calculateVolumePrice(229, qty);

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Collaboratori & Affiliati</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin')}>← Admin</Button>
          <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Annulla' : '+ Nuovo Collaboratore'}</Button>
        </div>
      </div>

      {/* Volume pricing reference */}
      <Card>
        <CardHeader><CardTitle>Prezzi Volume (per collaboratori)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-3 border rounded text-center">
              <div className="text-2xl font-bold text-brand">1-5</div>
              <div className="text-text-muted">Standard</div>
              <div>229€ cad</div>
            </div>
            <div className="p-3 border rounded text-center bg-brand/5">
              <div className="text-2xl font-bold text-brand">6-11</div>
              <div className="text-text-muted">-50% volume</div>
              <div>114.50€ cad</div>
            </div>
            <div className="p-3 border rounded text-center bg-green-50">
              <div className="text-2xl font-bold text-brand">12+</div>
              <div className="text-text-muted">-50% + 1 gratis</div>
              <div>{vol(12).total}€ per 12, ricevi 13</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>Nuovo Collaboratore</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Nome *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full border rounded p-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border rounded p-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Ruolo</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="w-full border rounded p-2 text-sm">
                  <option value="">Seleziona</option>
                  <option value="fotografo">Fotografo</option>
                  <option value="parrucchiere">Parrucchiere</option>
                  <option value="autista">Autista</option>
                  <option value="wedding_planner">Wedding Planner</option>
                  <option value="influencer">Influencer</option>
                  <option value="location">Location</option>
                  <option value="altro">Altro</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Azienda</label>
                <input value={company} onChange={e => setCompany(e.target.value)}
                  className="w-full border rounded p-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Commissione %</label>
                <input type="number" value={commissionRate} onChange={e => setCommissionRate(e.target.value)}
                  className="w-full border rounded p-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Codice Coupon personale</label>
                <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  className="w-full border rounded p-2 text-sm" placeholder="ES: FOTO_MARCO" />
              </div>
            </div>
            <p className="text-xs text-text-muted">Il collaboratore riceve {commissionRate}% di commissione. Il cliente finale ha 15% di sconto.</p>
            <Button onClick={handleCreate}>Salva Collaboratore</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Collaboratori ({affiliates.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Codice</TableHead>
                <TableHead>Commissione</TableHead>
                <TableHead>Referral</TableHead>
                <TableHead>Guadagnato</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell><Badge variant="outline">{a.role || '-'}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{a.coupon_code || '-'}</TableCell>
                  <TableCell>{a.commission_rate}%</TableCell>
                  <TableCell>{a.total_referrals}</TableCell>
                  <TableCell>{a.total_commission}€</TableCell>
                  <TableCell><Badge variant={a.is_active ? 'default' : 'secondary'}>{a.is_active ? 'Attivo' : 'Inattivo'}</Badge></TableCell>
                  <TableCell>
                    <Button variant="link" size="sm" onClick={() => viewReferrals(a)}>Referral</Button>
                  </TableCell>
                </TableRow>
              ))}
              {affiliates.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-text-muted">Nessun collaboratore ancora</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedAffiliate && (
        <Card>
          <CardHeader>
            <CardTitle>Referral di {selectedAffiliate.name}
              <Button variant="ghost" size="sm" className="ml-2" onClick={() => setSelectedAffiliate(null)}>Chiudi</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Codice</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Sconto</TableHead>
                  <TableHead>Commissione</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString('it-IT')}</TableCell>
                    <TableCell className="font-mono">{r.coupon_code}</TableCell>
                    <TableCell>{r.tier_acquistato || '-'}</TableCell>
                    <TableCell>{r.sconto_coupon ? `${r.sconto_coupon}€` : '-'}</TableCell>
                    <TableCell>{r.commission_amount ? `${r.commission_amount}€` : '-'}</TableCell>
                    <TableCell><Badge variant={r.status === 'paid' ? 'default' : r.status === 'converted' ? 'secondary' : 'outline'}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {referrals.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-text-muted">Nessun referral ancora</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
