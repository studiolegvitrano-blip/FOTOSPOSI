'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getProduct, createCheckoutSession } from '@fotosposi/commerce';
import type { Product } from '@fotosposi/commerce';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('commerce');
  const c = useTranslations('common');
  const eventId = params.id as string;
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');
  const [ibanInfo, setIbanInfo] = useState<{ iban: string; holder: string; bank: string; reference: string } | null>(null);

  useEffect(() => {
    if (!productId) return;
    getProduct(productId).then((r) => {
      if (r.product) setProduct(r.product);
      setLoading(false);
    });
  }, [productId]);

  const handleBuy = async () => {
    if (!product) return;
    setCheckingOut(true);
    setError('');
    setIbanInfo(null);

    const { url, error: err } = await createCheckoutSession({
      productId: product.id,
      successUrl: `${window.location.origin}/events/${eventId}/shop/orders?success=1`,
      cancelUrl: `${window.location.origin}/events/${eventId}/shop/product/${product.id}`,
    });

    if (err) {
      setError(err);
      setCheckingOut(false);
    } else if (url) {
      window.location.href = url;
    }
  };

  // Pagamento con bonifico: mostra le coordinate, l'ordine resta pending
  // finché l'admin non conferma (vedi /admin/orders).
  const handleIban = async () => {
    if (!product) return;
    setCheckingOut(true);
    setError('');
    setIbanInfo(null);
    try {
      const res = await fetch('/api/orders/iban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          total: product.price,
          currency: product.currency,
          metadata: { kind: 'product', productId: product.id, productName: product.name },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Errore');
        return;
      }
      setIbanInfo({
        iban: json.iban?.iban ?? '',
        holder: json.iban?.holder ?? '',
        bank: json.iban?.bank ?? '',
        reference: json.reference ?? '',
      });
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) return <p>{c('loading')}</p>;
  if (!product) return <p>{t('no_products')}</p>;

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} style={{ width: '100%', borderRadius: 8 }} />
          ) : (
            <div style={{ width: '100%', height: 300, background: '#f5f5f5', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
              {product.type}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1>{product.name}</h1>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>{t('type')} {product.type}</p>
          {product.description && <p style={{ marginBottom: '1rem' }}>{product.description}</p>}
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d4a574', marginBottom: '1.5rem' }}>
            {(product.price / 100).toFixed(2)} {product.currency}
          </p>

          {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}

          {ibanInfo ? (
            <div style={{ border: '1px solid #d4a574', borderRadius: 8, padding: '1rem', background: '#faf3ec', marginBottom: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{t('iban_title')}</p>
              <p style={{ fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{ibanInfo.iban}</p>
              <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.25rem' }}>
                {ibanInfo.holder}{ibanInfo.bank ? ` · ${ibanInfo.bank}` : ''}
              </p>
              <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.25rem' }}>
                {t('iban_reference')}: <code>{ibanInfo.reference}</code>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#777' }}>{t('iban_note')}</p>
            </div>
          ) : (
            <>
              <button
                onClick={handleBuy}
                disabled={checkingOut}
                style={{
                  padding: '0.75rem 3rem',
                  background: '#d4a574',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  marginRight: '0.5rem',
                }}
              >
                {checkingOut ? t('redirecting') : t('buy_now')}
              </button>
              <button
                onClick={handleIban}
                disabled={checkingOut}
                style={{
                  padding: '0.75rem 2rem',
                  background: '#fff',
                  color: '#333',
                  border: '1px solid #ccc',
                  borderRadius: 8,
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                {t('buy_iban')}
              </button>
            </>
          )}
        </div>
      </div>

      <p style={{ marginTop: '2rem' }}>
        <Link href={`/events/${eventId}/shop`} style={{ color: '#d4a574' }}>{t('back_to_shop')}</Link>
      </p>
    </main>
  );
}
