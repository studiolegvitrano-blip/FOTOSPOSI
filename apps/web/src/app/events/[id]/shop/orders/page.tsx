'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getOrdersByEvent } from '@fotosposi/commerce';
import { getCurrentUser } from '@fotosposi/core';
import type { Order } from '@fotosposi/commerce';

const STATUS_LABELS: Record<string, string> = {
  pending: 'order_pending',
  paid: 'order_paid',
  fulfilled: 'order_fulfilled',
  cancelled: 'order_cancelled',
};

export default function OrdersPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const t = useTranslations('commerce');
  const c = useTranslations('common');
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
          <h2 style={{ color: '#2e7d32' }}>{t('payment_success_title')}</h2>
          <p>{t('payment_success_message')}</p>
        </div>
      )}

      <h1 style={{ marginBottom: '1.5rem' }}>{t('your_orders')}</h1>

      {myOrders.length === 0 ? (
        <p style={{ color: '#666' }}>{t('no_orders_yet')}</p>
      ) : (
        <div>
          {myOrders.map((o) => (
            <div key={o.id} style={{ padding: '1rem', border: '1px solid #eee', borderRadius: 8, marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontWeight: 500 }}>{t('order_of')} {new Date(o.created_at).toLocaleDateString('it-IT')}</p>
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
                  {t(STATUS_LABELS[o.status] || 'order_pending')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: '1rem' }}>
        <Link href={`/events/${eventId}/shop`} style={{ color: '#d4a574' }}>{t('back_to_shop')}</Link>
      </p>
    </main>
  );
}
