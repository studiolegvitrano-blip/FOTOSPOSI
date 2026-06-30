'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getGiftTransactions, createGiftCheckoutSession } from '@fotosposi/commerce';
import { getCurrentUser } from '@fotosposi/core';
import type { GiftRegistryTransaction } from '@fotosposi/commerce';

export default function GiftRegistryPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [transactions, setTransactions] = useState<GiftRegistryTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [amount, setAmount] = useState(50);
  const [message, setMessage] = useState('');
  const [fromName, setFromName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getGiftTransactions(eventId).then((r) => {
      if (r.transactions) setTransactions(r.transactions);
      if (r.total !== undefined) setTotal(r.total);
    });
  }, [eventId]);

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const { url, error: err } = await createGiftCheckoutSession({
      event_id: eventId,
      from_name: fromName,
      amount,
      message: message || undefined,
      successUrl: `${baseUrl}/events/${eventId}/gift?success=1`,
      cancelUrl: `${baseUrl}/events/${eventId}/gift`,
    });

    if (err) {
      setError(err);
      setLoading(false);
    } else if (url) {
      window.location.href = url;
    }
  };

  const presetAmounts = [30, 50, 100, 150, 200];

  return (
    <main style={{ maxWidth: 700, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Lista nozze</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Totale raccolto: {(total / 100).toFixed(2)} EUR
      </p>

      <div style={{ marginBottom: '2rem', padding: '1.5rem', border: '1px solid #ddd', borderRadius: 8 }}>
        <h2 style={{ marginBottom: '1rem' }}>Contribuisci</h2>
        <form onSubmit={handleContribute}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Il tuo nome</label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              required
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Importo</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {presetAmounts.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(a)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: amount === a ? '#d4a574' : '#f5f5f5',
                    color: amount === a ? '#fff' : '#333',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  {a} EUR
                </button>
              ))}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={5}
                style={{ width: 120, padding: '0.5rem', fontSize: '1rem' }}
              /> EUR
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem' }}>Messaggio (opzionale)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
              placeholder="Auguri per gli sposi..."
            />
          </div>

          {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 2rem',
              background: '#d4a574',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: '1.1rem',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Reindirizzamento...' : 'Contribuisci'}
          </button>
        </form>
      </div>

      {transactions.length > 0 && (
        <div>
          <h2 style={{ marginBottom: '1rem' }}>Contributi ricevuti</h2>
          {transactions.map((t) => (
            <div key={t.id} style={{ padding: '0.75rem', border: '1px solid #eee', borderRadius: 6, marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ fontWeight: 500 }}>{(t.amount / 100).toFixed(2)} EUR</p>
                <small style={{ color: '#999' }}>{new Date(t.created_at).toLocaleDateString('it-IT')}</small>
              </div>
              {t.message && <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>"{t.message}"</p>}
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: '2rem' }}>
        <Link href={`/events/${eventId}`} style={{ color: '#d4a574' }}>← Torna all'evento</Link>
      </p>
    </main>
  );
}
