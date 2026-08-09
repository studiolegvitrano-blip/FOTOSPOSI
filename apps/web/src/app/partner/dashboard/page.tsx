'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { signOut, getCurrentUser } from '@fotosposi/core';
import { getPartnerPackagePrice } from '@fotosposi/partner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PartnerProfile {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  logo_url: string | null;
  claim_text: string | null;
  affiliate_id: string | null;
}

interface PartnerCode {
  id: string;
  code: string;
  package_size: number;
  status: string;
  created_at: string;
}

const PACKAGE_TIERS = ['premium', 'deluxe'] as const;

export default function PartnerDashboardPage() {
  const t = useTranslations('partner');
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [codes, setCodes] = useState<PartnerCode[]>([]);
  const [buying, setBuying] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [savingClaim, setSavingClaim] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [claimText, setClaimText] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');

  const load = useCallback(async () => {
    const me = await fetch('/api/partner/me').then((r) => r.json());
    if (me?.error || !me?.partner) {
      router.push('/partner/login');
      return;
    }
    setPartner(me.partner);
    setClaimText(me.partner.claim_text ?? '');
    setWebsite(me.partner.website ?? '');
    setAddress(me.partner.address ?? '');
    const codesRes = await fetch('/api/partner/codes').then((r) => r.json());
    if (!codesRes.error) setCodes(codesRes.codes ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    getCurrentUser().then(({ user, error }) => {
      if (error || !user) {
        router.push(`/partner/login`);
        return;
      }
      load();
    });
  }, [load, router]);

  const handleBuy = async (tier: 'premium' | 'deluxe') => {
    setBuying(tier);
    try {
      const res = await fetch('/api/partner/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, quantity: 10 }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Errore');
        return;
      }
      await load();
      alert(`Pacchetto ${tier} creato: ${(json.codes ?? []).length} codici generati`);
    } finally {
      setBuying(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await fetch('/api/partner/logo', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Errore upload');
        return;
      }
      await load();
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSaveClaim = async () => {
    setSavingClaim(true);
    setSavedMsg(false);
    try {
      const res = await fetch('/api/partner/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimText, website, address }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Errore');
        return;
      }
      setSavedMsg(true);
      setPartner(json.partner);
    } finally {
      setSavingClaim(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/partner/login');
  };

  if (loading) return null;

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('dashboard_title')}</h1>
        <div className="flex gap-2 items-center">
          <a href="/dashboard" className="text-sm text-brand hover:underline">Dashboard eventi</a>
          <Button variant="ghost" size="sm" onClick={handleLogout}>{t('dashboard_logout')}</Button>
        </div>
      </div>

      {partner?.affiliate_id && (
        <Card>
          <CardContent className="py-3 text-sm">
            <Badge variant="success">Collaboratore Sposi.live</Badge>
            <span className="ml-2 text-text-muted">Account collegato: accedi con il tuo account collaboratore</span>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard_packages')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {PACKAGE_TIERS.map((tier) => {
              const p = getPartnerPackagePrice(tier, 10);
              return (
                <div key={tier} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <p className="font-medium">{tier === 'premium' ? t('package_premium') : t('package_deluxe')}</p>
                    <p className="text-sm text-text-muted">
                      10 licenze · {t('package_unit_price').replace('{price}', String(p.unitPrice))}
                      {p.discountPercent > 0 && <span className="ml-2 text-success">-{p.discountPercent}%</span>}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => handleBuy(tier)} disabled={buying === tier}>
                    {buying === tier ? '...' : t('package_buy')}
                  </Button>
                </div>
              );
            })}
            <p className="text-xs text-text-muted">12+ licenze: -50% + 1 licenza gratis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard_codes')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {codes.length === 0 && (
              <p className="text-sm text-text-muted">{t('dashboard_codes_empty')}</p>
            )}
            {codes.map((c) => (
              <div key={c.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                <code className="font-mono">{c.code}</code>
                <Badge variant={c.status === 'available' ? 'success' : c.status === 'used' ? 'secondary' : 'destructive'}>
                  {c.status === 'available' ? t('code_ready') : c.status === 'used' ? t('code_used') : t('code_revoked')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard_logo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {partner?.logo_url && (
              <div className="p-3 border rounded bg-muted w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partner.logo_url} alt="logo" className="h-12 w-auto" />
              </div>
            )}
            <Label htmlFor="logo">Logo (PNG trasparente, max 2MB)</Label>
            <Input id="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogoUpload} disabled={logoUploading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard_claim')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="claim">Testo "Questo servizio è offerto da"</Label>
              <Input id="claim" value={claimText} onChange={(e) => setClaimText(e.target.value)} placeholder="Es. Villa dei Fiori · Via Roma 1 · villadeifiori.it" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Sito web</Label>
              <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Indirizzo</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Via Roma 1, 00100 Roma" />
            </div>
            <Button onClick={handleSaveClaim} disabled={savingClaim}>
              {savingClaim ? '...' : t('dashboard_save')}
            </Button>
            {savedMsg && <span className="ml-3 text-sm text-success">{t('dashboard_saved')}</span>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
