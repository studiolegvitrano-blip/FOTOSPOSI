'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient, getEventTier, type Tier } from '@fotosposi/core';
import { validateCoupon, calculateVolumePrice } from '@fotosposi/commerce';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PRICES: Record<string, { premium: number; deluxe: number }> = {
  IT: { premium: 229, deluxe: 375 },
  US: { premium: 499, deluxe: 799 },
  GB: { premium: 399, deluxe: 649 },
  DE: { premium: 249, deluxe: 399 },
  FR: { premium: 249, deluxe: 399 },
  ES: { premium: 229, deluxe: 375 },
};

export default function TierPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const t = useTranslations();
  const [currentTier, setCurrentTier] = useState<Tier>('free');
  const [couponCode, setCouponCode] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ valid: boolean; text: string } | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [bulkQty, setBulkQty] = useState(1);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
      getEventTier(eventId).then(({ tier }) => { if (tier) setCurrentTier(tier); });
    });
  }, [eventId, router]);

  const handleValidate = async () => {
    if (!couponCode) return;
    const result = await validateCoupon(couponCode);
    if (result.valid && result.coupon) {
      const discount = result.coupon.discount_type === 'percentage'
        ? Math.round(229 * (result.coupon.discount_value / 100) * 100) / 100
        : result.coupon.discount_value;
      setCouponDiscount(discount);
      setCouponMsg({ valid: true, text: `Sconto: ${result.discount_label}!` });
    } else {
      setCouponDiscount(0);
      setCouponMsg({ valid: false, text: result.error || 'Codice non valido' });
    }
  };

  const basePrice = PRICES['IT']!.premium;
  const vol = calculateVolumePrice(basePrice, bulkQty);
  const finalPrice = Math.max(0, vol.total - couponDiscount);
  const monthly = (finalPrice / 3).toFixed(2);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Piano {currentTier === 'free' ? 'Free' : currentTier === 'premium' ? 'Premium' : 'Deluxe'}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={currentTier === 'free' ? 'border-brand' : ''}>
          <CardHeader><CardTitle>Free</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">€0</p>
            <ul className="text-sm space-y-1 mt-2">
              <li>✓ max 100 foto</li>
              <li>✗ compresse (SD)</li>
              <li>✗ niente video</li>
              <li>✓ wall + giochi base</li>
            </ul>
            {currentTier === 'free' && <Badge className="mt-2">Attuale</Badge>}
          </CardContent>
        </Card>

        <Card className={currentTier === 'premium' ? 'border-brand' : 'border-brand/30'}>
          <CardHeader><CardTitle>Premium</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">€{finalPrice || 229}</p>
            {couponDiscount > 0 && <p className="text-xs text-green-600">-{couponDiscount}€ sconto applicato</p>}
            <p className="text-xs text-text-muted mt-1">o <strong>{monthly}€/mese</strong> in 3 rate con Klarna</p>
            <ul className="text-sm space-y-1 mt-2">
              <li>✓ foto illimitate originali</li>
              <li>✓ video illimitati</li>
              <li>✓ Drive backup</li>
              <li>✓ tutti i giochi</li>
              <li>✓ Time Capsule</li>
              <li>✓ sito-evento brandizzato</li>
              <li>✓ RSVP + menu + mappe</li>
            </ul>
            {currentTier === 'premium' && <Badge className="mt-2">Attuale</Badge>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Deluxe</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">€375</p>
            <ul className="text-sm space-y-1 mt-2">
              <li>✓ tutto Premium</li>
              <li>✓ app mobile brandizzata</li>
              <li>✓ AI concierge</li>
              <li>✓ kiosk selfie</li>
              <li>✓ <strong>sito col tuo nome</strong> (es. marioelucia.fotosposi.it)</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {currentTier === 'free' && (
        <Card>
          <CardHeader><CardTitle>Coupon Sconto</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 border rounded p-2 text-sm font-mono" placeholder="CODICE" />
              <Button onClick={handleValidate} variant="outline">Applica</Button>
            </div>
            {couponMsg && (
              <p className={`text-sm ${couponMsg.valid ? 'text-green-600' : 'text-red-600'}`}>
                {couponMsg.text}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Acquisto multiplo (per professionisti)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <label className="text-sm">Licenze:</label>
            <input type="number" min={1} max={100} value={bulkQty}
              onChange={e => setBulkQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 border rounded p-2 text-sm" />
            <span className="text-sm">
              {vol.discountPercent > 0 && <Badge variant="default" className="mr-2">-{vol.discountPercent}%</Badge>}
              {vol.freeLicenses > 0 && <Badge variant="default" className="mr-2">+{vol.freeLicenses} gratis</Badge>}
              {vol.unitPrice}€ cad → <strong>{finalPrice}€ totale</strong>
              {vol.freeLicenses > 0 && <span className="text-xs text-text-muted ml-2">(paghi {bulkQty} a {vol.unitPrice}€, ricevi {bulkQty + vol.freeLicenses})</span>}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => router.push(`/events/${eventId}`)}>← Torna all'evento</Button>
        {currentTier === 'free' && (
          <Button disabled>Passa a Premium (richiede Stripe)</Button>
        )}
      </div>

      <p className="text-xs text-text-muted text-center">
        Klarna: paghi in 3 rate senza interessi. Stripe richiede configurazione chiave.
      </p>
    </main>
  );
}
