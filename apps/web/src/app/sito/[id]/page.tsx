import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateIcsLink } from '@fotosposi/site-builder';
import type { SiteDraft } from '@fotosposi/site-builder';

async function getDraft(draftId: string): Promise<SiteDraft | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data } = await supabase.from('site_drafts').select('*').eq('id', draftId).single();
  return data;
}

export default async function PublicSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await getDraft(id);
  if (!draft || !draft.published) {
    return (
      <html lang="it"><body style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8f8f8', color: '#666' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 48, margin: 0 }}>&#x2665;</h1>
          <p>Sito non ancora pubblicato.</p>
        </div>
      </body></html>
    );
  }

  const c = draft.content as Record<string, any>;
  const p0 = '#d4a574'; const p1 = '#f5f0eb'; const p2 = '#1a1a2e'; const p3 = '#ffffff';
  const font = 'Georgia, serif';
  const dateFormatted = c.date ? new Date(c.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <html lang="it">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{c.coupleNames || 'Matrimonio'} · Sito invito</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Georgia&family=Montserrat:wght@300;400;600;700&family=Poppins:wght@300;400;600;700&display=swap" rel="stylesheet" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: ${font}; -webkit-font-smoothing: antialiased; }
          a { color: inherit; }
          a[rel~=noopener] { text-decoration: none; }
          @media (max-width: 640px) {
            .hero { padding: 48px 24px !important; }
            .hero h1 { font-size: 2rem !important; }
            .section { padding: 32px 24px !important; }
          }
        `}</style>
      </head>
      <body>
        <div style={{ maxWidth: 600, margin: '0 auto', background: p3, minHeight: '100vh' }}>
          <div className="hero" style={{ padding: '80px 32px', textAlign: 'center', background: `linear-gradient(180deg, ${p1} 0%, ${p3} 100%)`, color: p2 }}>
            <p style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.3em', color: p0, marginBottom: 24 }}>{c.announcement || 'Vi annunciano il loro matrimonio'}</p>
            <h1 style={{ fontSize: 42, fontWeight: 700, lineHeight: 1.2, marginBottom: 16, color: p2 }}>{c.coupleNames || 'I vostri nomi'}</h1>
            <div style={{ width: 60, height: 2, background: p0, margin: '0 auto 24px' }} />
            <p style={{ fontSize: 16, color: p2, opacity: 0.8, marginBottom: 8 }}>{dateFormatted}</p>
            {c.time && <p style={{ fontSize: 14, color: p0, marginBottom: 24 }}>Ore {c.time}</p>}
            {c.date && c.time && (
              <a href={generateIcsLink(c.date, c.time, `Matrimonio ${c.coupleNames || ''}`, '', '')} download="matrimonio.ics" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 999, fontSize: 14, background: p0, color: '#fff', textDecoration: 'none' }}>
                + Calendario
              </a>
            )}
          </div>

          {c.ceremonyEnabled && (
            <div className="section" style={{ padding: '48px 32px', background: p3, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>{c.ceremonyTitle || 'Cerimonia'}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 4 }}>{c.ceremonyAddress || ''}</p>
              {c.ceremonyTime && <p style={{ fontSize: 14, color: p0, marginBottom: 12 }}>Ore {c.ceremonyTime}</p>}
              {c.ceremonyNote && <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>{c.ceremonyNote}</p>}
              {c.ceremonyAddress && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.ceremonyAddress)}`} target="_blank" style={{ fontSize: 13, color: p0, textDecoration: 'underline', display: 'inline-block', marginTop: 8 }}>Apri in Maps ↗</a>}
            </div>
          )}

          {c.receptionEnabled && (
            <div className="section" style={{ padding: '48px 32px', background: p1, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>{c.receptionTitle || 'Ricevimento'}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 4 }}>{c.receptionAddress || ''}</p>
              {c.receptionTime && <p style={{ fontSize: 14, color: p0, marginBottom: 12 }}>Ore {c.receptionTime}</p>}
              {c.receptionNote && <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>{c.receptionNote}</p>}
              {c.receptionAddress && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.receptionAddress)}`} target="_blank" style={{ fontSize: 13, color: p0, textDecoration: 'underline', display: 'inline-block', marginTop: 8 }}>Apri in Maps ↗</a>}
            </div>
          )}

          {c.storyEnabled && (
            <div className="section" style={{ padding: '48px 32px', background: p3, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>{c.storyTitle || 'La nostra storia'}</h2>
              <p style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.8 }}>{c.storyBody || ''}</p>
            </div>
          )}

          {c.registryEnabled && (
            <div className="section" style={{ padding: '48px 32px', textAlign: 'center', background: p1, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>Lista nozze</h2>
              {c.registryText && <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, marginBottom: 16 }}>{c.registryText}</p>}
              {c.registryIban && <p style={{ fontSize: 12, fontFamily: 'monospace', background: p3, padding: '8px 16px', borderRadius: 8, display: 'inline-block', marginBottom: 8 }}>IBAN: {c.registryIban}</p>}
              {c.registryIntestatario && <p style={{ fontSize: 12, opacity: 0.6 }}>Intestato a: {c.registryIntestatario}</p>}
              {c.registryLink && <a href={c.registryLink} target="_blank" style={{ display: 'inline-block', marginTop: 16, padding: '10px 24px', borderRadius: 999, fontSize: 14, background: p0, color: '#fff', textDecoration: 'none' }}>Vai alla lista ↗</a>}
            </div>
          )}

          {c.dressCodeEnabled && c.dressCodeText && (
            <div className="section" style={{ padding: '32px', textAlign: 'center', background: p3, color: p2 }}>
              <p style={{ fontSize: 14 }}><strong>Codice abbigliamento:</strong> {c.dressCodeText}</p>
            </div>
          )}

          {c.menuEnabled && c.menuText && (
            <div className="section" style={{ padding: '32px', background: p1, color: p2 }}>
              <h2 style={{ fontSize: 18, color: p0, marginBottom: 12 }}>Menu</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>{c.menuText}</p>
              {c.menuAllergens && <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>Allergeni: {c.menuAllergens}</p>}
            </div>
          )}

          {c.hotelsEnabled && c.hotelsText && (
            <div className="section" style={{ padding: '32px', background: p3, color: p2 }}>
              <h2 style={{ fontSize: 18, color: p0, marginBottom: 12 }}>Hotel consigliati</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>{c.hotelsText}</p>
            </div>
          )}

          {c.playlistEnabled && c.playlistLink && (
            <div className="section" style={{ padding: '32px', textAlign: 'center', background: p1, color: p2 }}>
              <h2 style={{ fontSize: 18, color: p0, marginBottom: 12 }}>Playlist</h2>
              <a href={c.playlistLink} target="_blank" style={{ fontSize: 14, color: p0, textDecoration: 'underline' }}>Ascolta la playlist ↗</a>
            </div>
          )}

          {c.rsvpEnabled && (
            <div className="section" style={{ padding: '48px 32px', textAlign: 'center', background: p3, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>RSVP</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, marginBottom: 12 }}>{c.rsvpMessage || 'Conferma la tua presenza'}</p>
              {c.rsvpDeadline && <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>Entro il {new Date(c.rsvpDeadline).toLocaleDateString('it-IT')}</p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                {c.rsvpEmail && <a href={`mailto:${c.rsvpEmail}`} style={{ padding: '12px 32px', borderRadius: 999, fontSize: 15, background: p0, color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Conferma presenza</a>}
                {c.rsvpWhatsapp && <a href={`https://wa.me/${c.rsvpWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" style={{ padding: '12px 32px', borderRadius: 999, fontSize: 15, background: p0, color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Conferma via WhatsApp</a>}
              </div>
            </div>
          )}

          {c.hashtagEnabled && c.hashtag && (
            <div className="section" style={{ padding: '24px', textAlign: 'center', background: p2, color: p3 }}>
              <p style={{ fontSize: 14 }}>Seguici con <strong>{c.hashtag}</strong></p>
            </div>
          )}

          <div style={{ padding: '32px', textAlign: 'center', fontSize: 12, opacity: 0.4, color: p2, background: p1 }}>
            <p>Creato con FotoSposi · Il tuo invito digitale</p>
          </div>
        </div>
      </body>
    </html>
  );
}
