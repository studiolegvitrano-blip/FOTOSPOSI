'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getOrdersByEvent } from '@fotosposi/commerce';
import { getCurrentUser } from '@fotosposi/core';
import type { Order } from '@fotosposi/commerce';

export default function OrdersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const eventId = params.id as string;
  const success = searchParams.get('success');

  const [orders, setOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(({ user }) => { if (user) setUserId(user.id); });
    getOrdersByEvent(eventId).then((r) => { if (r.orders) setOrders(r.orders); });
  }, [eventId]);

  const myOrders = orders.filter((o) => o.user_id === userId);

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      {success && (
        <div style={{ padding: '1rem', background: '#e8f5e9', borderRadius: 8, marginBottom: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: '#2e7d32' }}>Pagamento riuscito!</h2>
          <p>Grazie per il tuo ordine. Riceverai una conferma via email.</p>
        </div>
      )}

      <h1 style={{ marginBottom: '1.5rem' }}>I tuoi ordini</h1>

      {myOrders.length === 0 ? (
        <p style={{ color: '#666' }}>Ancora nessun ordine</p>
      ) : (
        <div>
          {myOrders.map((o) => (
            <div key={o.id} style={{ padding: '1rem', border: '1px solid #eee', borderRadius: 8, marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 500 }}>Ordine del {new Date(o.created_at).toLocaleDateString('it-IT')}</p>
                  <p style={{ color: '#666' }}>
                    {(o.total / 100).toFixed(2)} {o.currency}
                  </p>
                </div>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: 4,
                  fontSize: '0.85rem',
                  background: o.status === 'paid' ? '#e8f5e9' : o.status === 'fulfilled' ? '#e3f2fd' : '#fff3e0',
                  color: o.status === 'paid' ? '#2e7d32' : o.status === 'fulfilled' ? '#1565c0' : '#e65100',
                }}>
                  {o.status === 'paid' ? 'Pagato' : o.status === 'fulfilled' ? 'In lavorazione' : o.status === 'cancelled' ? 'Annullato' : 'In attesa'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: '1rem' }}>
        <Link href={`/events/${eventId}/shop`} style={{ color: '#d4a574' }}>← Torna allo shop</Link>
      </p>
    </main>
  );
}
