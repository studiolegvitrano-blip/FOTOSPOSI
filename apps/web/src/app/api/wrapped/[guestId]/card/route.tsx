import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { getGuestWrapped } from '@fotosposi/wrapped';

export const runtime = 'edge';

export async function GET(req: NextRequest, { params }: { params: Promise<{ guestId: string }> }) {
  const { guestId } = await params;
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return new Response('Missing eventId', { status: 400 });
  }

  const { wrapped, error } = await getGuestWrapped(eventId, guestId);
  if (error || !wrapped) {
    return new Response(error || 'Not found', { status: 404 });
  }

  const primaryColor = '#d4a574';
  const bgColor = '#1a1a2e';
  const accentColor = '#e94560';
  const textColor = '#ffffff';
  const mutedColor = 'rgba(255,255,255,0.6)';

  const cardData = [
    { label: 'Foto caricate', value: String(wrapped.photoCount), icon: '📸' },
    { label: 'Voti espressi', value: String(wrapped.voteCount), icon: '🗳️' },
    { label: 'Volte taggato', value: String(wrapped.tagCount), icon: '🏷️' },
    { label: 'Barzellette inviate', value: String(wrapped.jokeCount), icon: '😂' },
    { label: 'Video messaggi', value: String(wrapped.videoCount), icon: '🎥' },
  ];

  if (wrapped.giftTotal > 0) {
    cardData.push({ label: 'Contributo lista nozze', value: `€${wrapped.giftTotal}`, icon: '🎁' });
  }

  const badgesHtml = wrapped.badges.length > 0
    ? wrapped.badges.map(b => `<span style="background:${primaryColor};color:#1a1a2e;padding:8px 20px;border-radius:30px;font-size:20px;font-weight:600;display:inline-block">${b}</span>`).join('')
    : '';

  const wordmark = wrapped.brand === 'fotosposi' ? 'fotosposi.it' : 'weddingmoments.app';

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1920,
          background: `linear-gradient(135deg, ${bgColor} 0%, #16213e 50%, ${bgColor} 100%)`,
          color: textColor,
          fontFamily: '"Inter", sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 80px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', top: -100, right: -100, width: 500, height: 500,
          borderRadius: '50%', background: `${primaryColor}15`,
        }} />
        <div style={{
          position: 'absolute', bottom: -150, left: -80, width: 400, height: 400,
          borderRadius: '50%', background: `${accentColor}10`,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <span style={{ fontSize: 24, color: mutedColor, marginBottom: 8 }}>Il tuo Wedding Wrapped</span>
          <span style={{ fontSize: 48, fontWeight: 700, color: primaryColor, textAlign: 'center' }}>
            {wrapped.coupleName}
          </span>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 24,
          padding: '40px 50px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          width: '100%',
          maxWidth: 700,
        }}>
          {cardData.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: i < cardData.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
              paddingBottom: i < cardData.length - 1 ? 16 : 0,
            }}>
              <span style={{ fontSize: 22, color: mutedColor }}>{item.icon} {item.label}</span>
              <span style={{ fontSize: 36, fontWeight: 700, color: primaryColor }}>{item.value}</span>
            </div>
          ))}
        </div>

        {badgesHtml && (
          <div style={{
            display: 'flex', gap: 16, marginTop: 40, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {badgesHtml.split('</span>').map((_, i) => {
              if (i >= wrapped.badges.length) return null;
              const b = wrapped.badges[i];
              if (!b) return null;
              return (
                <span key={i} style={{
                  background: primaryColor, color: '#1a1a2e',
                  padding: '8px 20px', borderRadius: 30, fontSize: 20, fontWeight: 600,
                }}>
                  {b}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 16, color: mutedColor }}>Ciao {wrapped.guestName}!</span>
          <span style={{ fontSize: 14, color: mutedColor, opacity: 0.5, marginTop: 4 }}>{wordmark}</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1920 },
  );
}
