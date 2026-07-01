'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getGuestWrapped, type GuestWrapped } from '@fotosposi/wrapped';
import { Button } from '@/components/ui/button';

export default function WrappedPage() {
  const params = useParams();
  const eventId = params.id as string;
  const guestId = params.guestId as string;

  const [data, setData] = useState<GuestWrapped | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !guestId) return;
    getGuestWrapped(eventId, guestId).then(({ wrapped, error: err }) => {
      if (err) setError(err);
      else if (wrapped) setData(wrapped);
      else setError('Dati non trovati');
      setLoading(false);
    });
  }, [eventId, guestId]);

  const handleShare = async () => {
    try {
      const resp = await fetch(`/api/wrapped/${guestId}/card?eventId=${eventId}`);
      if (!resp.ok) throw new Error('card failed');
      const blob = await resp.blob();
      const file = new File([blob], 'wedding_wrapped.jpg', { type: 'image/png' });
      const hashtag = '#' + data?.coupleName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + 'sposi';
      const appTag = data?.brand === 'fotosposi' ? '@fotosposi' : '@weddingmoments';
      const shareText = `Il mio Wedding Wrapped per ${data?.coupleName}! 🎉\n\n${hashtag} ${appTag}`;

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'wedding_wrapped.jpg'; a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      window.open(`/api/wrapped/${guestId}/card?eventId=${eventId}`, '_blank');
    }
  };

  if (loading) return <main className="max-w-lg mx-auto mt-16 p-4 text-center"><p>Caricamento...</p></main>;
  if (error || !data) return <main className="max-w-lg mx-auto mt-16 p-4 text-center"><h1 className="text-xl font-bold">{error || 'Errore'}</h1></main>;

  const primaryColor = '#d4a574';
  const bgColor = '#1a1a2e';

  return (
    <main style={{ background: bgColor, minHeight: '100vh', color: '#fff' }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '2rem 1rem', textAlign: 'center' }}>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>Il tuo</p>
        <h1 style={{ fontSize: 40, fontWeight: 700, color: primaryColor, marginBottom: 4 }}>Wedding Wrapped</h1>
        <p style={{ fontSize: 22, color: '#fff', marginBottom: 32 }}>{data.coupleName}</p>

        <div style={{
          background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '1.5rem',
          marginBottom: 24, textAlign: 'left',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span>👤 Nome</span><span style={{ fontWeight: 600 }}>{data.guestName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span>📸 Foto caricate</span><span style={{ fontWeight: 600, color: primaryColor }}>{data.photoCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span>🗳️ Voti espressi</span><span style={{ fontWeight: 600, color: primaryColor }}>{data.voteCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span>🏷️ Volte taggato</span><span style={{ fontWeight: 600, color: primaryColor }}>{data.tagCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span>😂 Barzellette</span><span style={{ fontWeight: 600, color: primaryColor }}>{data.jokeCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span>🎥 Video messaggi</span><span style={{ fontWeight: 600, color: primaryColor }}>{data.videoCount}</span>
          </div>
          {data.giftTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0' }}>
              <span>🎁 Regalo</span><span style={{ fontWeight: 600, color: primaryColor }}>€{data.giftTotal}</span>
            </div>
          )}
        </div>

        {data.badges.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 24 }}>
            {data.badges.map((b, i) => (
              <span key={i} style={{ background: primaryColor, color: '#1a1a2e', padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 600 }}>
                {b}
              </span>
            ))}
          </div>
        )}

        <img
          src={`/api/wrapped/${guestId}/card?eventId=${eventId}`}
          alt="Wedding Wrapped"
          style={{ width: '100%', maxWidth: 400, borderRadius: 16, margin: '0 auto 24px', display: 'block' }}
        />

        <Button onClick={handleShare} style={{ width: '100%', padding: '14px', fontSize: 18 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 8 }}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Condividi su Instagram, TikTok, WhatsApp
        </Button>
      </div>
    </main>
  );
}
