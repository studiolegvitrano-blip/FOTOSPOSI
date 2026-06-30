'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { listProducts } from '@fotosposi/commerce';
import type { Product } from '@fotosposi/commerce';

export default function ShopPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    listProducts(filter || undefined).then((r) => {
      if (r.products) setProducts(r.products);
    });
  }, [filter]);

  const categories = [
    { value: '', label: 'Tutti' },
    { value: 'stampa', label: 'Stampe' },
    { value: 'gadget', label: 'Gadget' },
    { value: 'maglietta', label: 'Magliette' },
    { value: 'album', label: 'Album' },
  ];

  return (
    <main style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Shop</h1>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {categories.map((c) => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            style={{
              padding: '0.5rem 1rem',
              background: filter === c.value ? '#d4a574' : '#f5f5f5',
              color: filter === c.value ? '#fff' : '#333',
              border: '1px solid #ddd',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
          Nessun prodotto disponibile
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem' }}>
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/events/${eventId}/shop/product/${p.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: 200, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                    {p.type}
                  </div>
                )}
                <div style={{ padding: '1rem' }}>
                  <h3 style={{ marginBottom: '0.25rem' }}>{p.name}</h3>
                  <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    {p.description?.slice(0, 80)}{p.description && p.description.length > 80 ? '...' : ''}
                  </p>
                  <p style={{ fontWeight: 'bold', color: '#d4a574', fontSize: '1.1rem' }}>
                    {(p.price / 100).toFixed(2)} {p.currency}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p style={{ marginTop: '2rem' }}>
        <Link href={`/events/${eventId}`} style={{ color: '#d4a574' }}>← Torna all'evento</Link>
      </p>
    </main>
  );
}
