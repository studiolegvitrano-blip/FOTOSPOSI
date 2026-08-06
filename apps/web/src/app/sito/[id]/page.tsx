import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateIcsLink } from '@fotosposi/site-builder';
import type { SiteDraft } from '@fotosposi/site-builder';
import WeddingFeedDemo from '@/components/wedding-feed-demo';
import WeatherWidget from '@/components/weather-widget';
import RsvpFormClient from '@/components/rsvp-form-client';

async function getDraft(draftId: string): Promise<{ draft: SiteDraft | null; template: any | null }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data } = await supabase.from('site_drafts').select('*, events!inner(couple_name, date, location, venue_city, church_city), site_templates!left(*)').eq('id', draftId).single();
  if (!data) return { draft: null, template: null };
  const event = data.events as { couple_name?: string; date?: string; location?: string; venue_city?: string; church_city?: string } | undefined;
  const template = data.site_templates as any | null;
  const content = data.content as Record<string, any>;
  if (event?.couple_name && !content.coupleNames) content.coupleNames = event.couple_name;
  if (event?.date && !content.date) content.date = event.date;
  if (event?.location && !content.eventCity) content.eventCity = event.location;
  if (event?.venue_city) content.eventCity = event.venue_city;
  if (event?.church_city) content.eventCity = event.church_city;
  delete (data as any).events;
  delete (data as any).site_templates;
  return { draft: { ...data, content }, template };
}

export default async function PublicSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { draft, template } = await getDraft(id);
  if (!draft || !draft.published) {
    return (
      <html lang="it"><body style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8f8f8', color: '#666' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 48, margin: 0 }}>&#x2665;</p>
          <p>Sito non ancora pubblicato.</p>
        </div>
      </body></html>
    );
  }

  const c = draft.content as Record<string, any>;
  const tpl = template;
  const p0 = tpl?.palette?.[0] || '#d4a574';
  const p1 = tpl?.palette?.[1] || '#f5f0eb';
  const p2 = tpl?.palette?.[2] || '#1a1a2e';
  const p3 = tpl?.palette?.[3] || '#ffffff';
  const font = tpl?.font_family || 'Georgia, serif';
  const dateFormatted = c.date ? new Date(c.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';

  return (
    <html lang="it">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{c.coupleNames || 'Matrimonio'} · Sito invito</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Georgia&family=Montserrat:wght@300;400;600;700&family=Poppins:wght@300;400;600;700&family=Playfair+Display:wght@400;600;700&family=Lora:wght@400;600&display=swap" rel="stylesheet" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: ${font}; -webkit-font-smoothing: antialiased; }
          a { color: inherit; }
          a[rel~=noopener] { text-decoration: none; }
          .section { padding: 48px 32px; }
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
              <a href={generateIcsLink(c.date, c.time, `Matrimonio ${c.coupleNames || ''}`, '', '')} download="matrimonio.ics" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 999, fontSize: 14, background: p0, color: p3, textDecoration: 'none' }}>
                + Calendario
              </a>
            )}
            {c.date && c.eventCity && (
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
                <WeatherWidget city={c.eventCity} eventDate={c.date} />
              </div>
            )}
          </div>

          {c.weddingPartyEnabled && (c.weddingPartyMembers?.length ?? 0) > 0 && (
            <div className="section" style={{ background: p3, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>{tpl?.name ? 'Wedding Party' : 'Testimoni'}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(c.weddingPartyMembers as any[]).map((m: { name?: string; role?: string; photoUrl?: string }, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {m.photoUrl && <img src={m.photoUrl} alt={m.name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />}
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 600 }}>{m.name || ''}</p>
                      <p style={{ fontSize: 13, color: p0 }}>{m.role || ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.ceremonyEnabled && (
            <div className="section" style={{ background: p3, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>{c.ceremonyTitle || 'Cerimonia'}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 4 }}>{c.ceremonyAddress || ''}</p>
              {c.ceremonyTime && <p style={{ fontSize: 14, color: p0, marginBottom: 12 }}>Ore {c.ceremonyTime}</p>}
              {c.ceremonyNote && <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>{c.ceremonyNote}</p>}
              {c.ceremonyAddress && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.ceremonyAddress)}`} target="_blank" style={{ fontSize: 13, color: p0, textDecoration: 'underline', display: 'inline-block', marginTop: 8 }}>Apri in Maps ↗</a>}
            </div>
          )}

          {c.receptionEnabled && (
            <div className="section" style={{ background: p1, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>{c.receptionTitle || 'Ricevimento'}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 4 }}>{c.receptionAddress || ''}</p>
              {c.receptionTime && <p style={{ fontSize: 14, color: p0, marginBottom: 12 }}>Ore {c.receptionTime}</p>}
              {c.receptionNote && <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>{c.receptionNote}</p>}
              {c.receptionAddress && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.receptionAddress)}`} target="_blank" style={{ fontSize: 13, color: p0, textDecoration: 'underline', display: 'inline-block', marginTop: 8 }}>Apri in Maps ↗</a>}
            </div>
          )}

          {c.storyEnabled && (
            <div className="section" style={{ background: p3, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>{c.storyTitle || 'La nostra storia'}</h2>
              <p style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.8 }}>{c.storyBody || ''}</p>
            </div>
          )}

          {c.registryEnabled && (
            <div className="section" style={{ textAlign: 'center', background: p1, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>Lista nozze</h2>
              {c.registryText && <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, marginBottom: 16 }}>{c.registryText}</p>}
              {c.registryIban && <p style={{ fontSize: 12, fontFamily: 'monospace', background: p3, padding: '8px 16px', borderRadius: 8, display: 'inline-block', marginBottom: 8 }}>IBAN: {c.registryIban}</p>}
              {c.registryIntestatario && <p style={{ fontSize: 12, opacity: 0.6 }}>Intestato a: {c.registryIntestatario}</p>}
                {c.registryLink && <a href={c.registryLink} target="_blank" style={{ display: 'inline-block', marginTop: 16, padding: '10px 24px', borderRadius: 999, fontSize: 14, background: p0, color: p3, textDecoration: 'none' }}>Vai alla lista ↗</a>}
            </div>
          )}

          {c.dressCodeEnabled && c.dressCodeText && (
            <div className="section" style={{ textAlign: 'center', background: p3, color: p2 }}>
              <p style={{ fontSize: 14 }}><strong>Codice abbigliamento:</strong> {c.dressCodeText}</p>
            </div>
          )}

          {c.menuEnabled && c.menuText && (
            <div className="section" style={{ background: p1, color: p2 }}>
              <h2 style={{ fontSize: 18, color: p0, marginBottom: 12 }}>Menu</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>{c.menuText}</p>
              {c.menuAllergens && <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>Allergeni: {c.menuAllergens}</p>}
            </div>
          )}

          {c.hotelsEnabled && c.hotelsText && (
            <div className="section" style={{ background: p3, color: p2 }}>
              <h2 style={{ fontSize: 18, color: p0, marginBottom: 12 }}>Hotel consigliati</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>{c.hotelsText}</p>
            </div>
          )}

          {c.playlistEnabled && c.playlistLink && (
            <div className="section" style={{ textAlign: 'center', background: p1, color: p2 }}>
              <h2 style={{ fontSize: 18, color: p0, marginBottom: 12 }}>Playlist</h2>
              <a href={c.playlistLink} target="_blank" style={{ fontSize: 14, color: p0, textDecoration: 'underline' }}>Ascolta la playlist ↗</a>
            </div>
          )}

          {c.rsvpEnabled && (
            <div className="section" style={{ textAlign: 'center', background: p3, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>RSVP</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, marginBottom: 12 }}>{c.rsvpMessage || 'Conferma la tua presenza'}</p>
              {c.rsvpDeadline && <p style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>Entro il {new Date(c.rsvpDeadline).toLocaleDateString('it-IT')}</p>}
              <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'left' }}>
                <RsvpFormClient
                  eventId={draft.event_id}
                  submitLabel="Conferma presenza"
                  successTitle="Grazie!"
                  successMessage="Presenza confermata. A presto!"
                  hostLabel="Il tuo nome"
                  hostNamePlaceholder="Nome e cognome"
                  addGuestLabel="Aggiungi accompagnatore"
                  removeLabel="Rimuovi"
                  guestNamePlaceholder="Nome e cognome"
                  adultLabel="Adulto"
                  minorLabel="Minore"
                  ageLabel="Età"
                  agePlaceholder="Es. 7"
                  intolerancesLabel="Intolleranze alimentari"
                  intolerancesHint="Seleziona tutte le intolleranze (per il menu)."
                  otherLabel="Altro"
                  otherPlaceholder="Scrivi la tua intolleranza"
                  messageLabel="Messaggio (opzionale)"
                  messagePlaceholder="Vuoi dire qualcosa agli sposi?"
                  errorGeneric="Errore nell'invio. Riprova."
                  submittingLabel="Invio in corso..."
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                {c.rsvpEmail && <a href={`mailto:${c.rsvpEmail}`} style={{ padding: '12px 32px', borderRadius: 999, fontSize: 15, background: p0, color: p3, textDecoration: 'none', fontWeight: 600 }}>Contatta via email</a>}
                {c.rsvpWhatsapp && <a href={`https://wa.me/${c.rsvpWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" style={{ padding: '12px 32px', borderRadius: 999, fontSize: 15, background: p0, color: p3, textDecoration: 'none', fontWeight: 600 }}>Scrivi su WhatsApp</a>}
              </div>
            </div>
          )}

          <div className="section" style={{ textAlign: 'center', background: p2, color: p3 }}>
            <h2 style={{ fontSize: 20, color: p0, marginBottom: 8 }}>Foto &amp; Giochi</h2>
            <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 20, lineHeight: 1.6 }}>
              Guarda le foto in tempo reale e partecipa ai giochi del matrimonio
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <a href={`/events/${draft.event_id}/games/wall`} style={{ padding: '12px 28px', borderRadius: 999, fontSize: 14, background: p0, color: p3, textDecoration: 'none', fontWeight: 600 }}>
                Vedi le foto
              </a>
              <a href={`/events/${draft.event_id}/games`} style={{ padding: '12px 28px', borderRadius: 999, fontSize: 14, background: 'transparent', color: p3, border: `1px solid ${p3}`, textDecoration: 'none', fontWeight: 600 }}>
                Giochi &amp; Challenge
              </a>
            </div>
          </div>

          {/* ── Feed live degli invitati ────────────────────────────── */}
          <WeddingFeedDemo />

          {c.navettaEnabled && (
            <div className="section" style={{ background: p3, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>Navetta ospiti</h2>
              {c.navettaOrari && <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.8, marginBottom: 12, whiteSpace: 'pre-line' }}>{c.navettaOrari}</p>}
              {c.navettaMappa && (
                <a href={c.navettaMappa} target="_blank" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 999, fontSize: 14, background: p0, color: p3, textDecoration: 'none', marginBottom: 12 }}>
                  Mappa parcheggio ↗
                </a>
              )}
              {c.navettaNote && <p style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{c.navettaNote}</p>}
              {c.navettaContatti && <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>Contatti: {c.navettaContatti}</p>}
              {c.navettaMatchmaking && (
                <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: p1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Auto Amica</p>
                  <p style={{ fontSize: 13, opacity: 0.7 }}>Chi dà un passaggio e chi cerca si organizzano qui</p>
                </div>
              )}
            </div>
          )}

          {c.faqEnabled && (c.faqEntries?.length ?? 0) > 0 && (
            <div className="section" style={{ background: p1, color: p2 }}>
              <h2 style={{ fontSize: 20, color: p0, marginBottom: 16 }}>FAQ</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(c.faqEntries as any[]).map((faq: { question?: string; answer?: string }, i: number) => (
                  <div key={i}>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{faq.question || ''}</p>
                    <p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>{faq.answer || ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.hashtagEnabled && c.hashtag && (
            <div className="section" style={{ textAlign: 'center', background: p2, color: p3 }}>
              <p style={{ fontSize: 14 }}>Seguici con <strong>{c.hashtag}</strong></p>
            </div>
          )}

          <div style={{ padding: '32px', textAlign: 'center', fontSize: 12, opacity: 0.4, color: p2, background: p1 }}>
            <p>Creato con Sposi.live · Il tuo invito digitale</p>
          </div>
        </div>
      </body>
    </html>
  );
}
