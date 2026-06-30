'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProduct, createCheckoutSession } from '@fotosposi/commerce';
import type { Product } from '@fotosposi/commerce';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const productId = params.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');

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

  if (loading) return <p>Caricamento...</p>;
  if (!product) return <p>Prodotto non trovato</p>;

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
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>Tipo: {product.type}</p>
          {product.description && <p style={{ marginBottom: '1rem' }}>{product.description}</p>}
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d4a574', marginBottom: '1.5rem' }}>
            {(product.price / 100).toFixed(2)} {product.currency}
          </p>

          {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}

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
            }}
          >
            {checkingOut ? 'Reindirizzamento...' : 'Acquista ora'}
          </button>
        </div>
      </div>

      <p style={{ marginTop: '2rem' }}>
        <Link href={`/events/${eventId}/shop`} style={{ color: '#d4a574' }}>← Torna allo shop</Link>
      </p>
    </main>
  );
}
