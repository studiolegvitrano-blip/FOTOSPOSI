'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';

export default function QrPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;

    getCurrentUser().then(async ({ user }) => {
      if (!user) return;

      const { getEventWindow } = await import('@fotosposi/events');
      const { window: evtWindow } = await getEventWindow(eventId);
      const expiresAt = evtWindow?.closes_at ? new Date(evtWindow.closes_at) : new Date(Date.now() + 86400000 * 365);

      const res = await fetch('/api/auth/qr-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, expiresAt: expiresAt.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError(data.error ?? 'Errore generazione QR');
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      setQrUrl(`${baseUrl}/event/${data.token.token}`);
    });
  }, [eventId]);

  return (
    <main style={{ maxWidth: 500, margin: '2rem auto', padding: '0 1rem', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>QR Code evento</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {qrUrl && (
        <div>
          <p style={{ marginBottom: '1rem', wordBreak: 'break-all' }}>Link: <a href={qrUrl}>{qrUrl}</a></p>
          <div style={{ display: 'inline-block', padding: '1rem', border: '1px solid #ddd', borderRadius: 8 }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`}
              alt="QR Code"
              width={250}
              height={250}
            />
          </div>
          <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
            QR valido fino al giorno dopo l'evento. Condividilo con gli invitati.
          </p>
        </div>
      )}
      <p style={{ marginTop: '2rem' }}>
        <a href={`/events/${eventId}`} style={{ color: '#d4a574' }}>← Torna all'evento</a>
      </p>
    </main>
  );
}
