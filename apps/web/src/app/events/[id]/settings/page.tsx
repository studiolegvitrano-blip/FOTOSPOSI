'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateEventWatermark, type WeddingEvent } from '@fotosposi/events';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Settings, Image as ImageIcon, Users, Bell, Shield, HardDrive, Globe, Loader2 } from 'lucide-react';
import { WATERMARK_FONTS } from '@/lib/watermark-fonts';

/**
 * Pagina Impostazioni riservata agli sposi (creatore evento): raccoglie in un
 * unico posto tutte le impostazioni prima sparse (watermark su foto/video con
 * testo E font, più i collegamenti alle altre aree di configurazione).
 * Gli invitati che provano ad aprirla vengono rimandati alla pagina evento.
 *
 * Novità: 28 font selezionabili (19 eleganti + 9 classici). Il menu a tendina
 * mostra ogni voce scritta col proprio font reale, così gli sposi vedono
 * immediatamente l'aspetto finale. Dopo la scelta, l'anteprima in basso mostra
 * la frase scelta col font scelto.
 */
export default function EventSettingsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const [wmNames, setWmNames] = useState(true);
  const [wmText, setWmText] = useState('');
  const [wmFont, setWmFont] = useState('classico');
  const [wmSaving, setWmSaving] = useState(false);
  const [wmSaved, setWmSaved] = useState(false);

  // Partecipanti (chi carica foto/video) e toggle "mostra ruoli in galleria".
  // I ruoli mostrati in galleria sono SOLO Testimone sposa/sposo, Padre, Madre
  // (vedi guest-roles.ts); gli altri (Amico, Parente, Collega, Altro) restano
  // salvati ma non compaiono nel feed.
  type Participant = {
    user_id: string;
    name: string;
    email: string | null;
    role_at_event: string | null;
    media_count: number;
  };
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showRoles, setShowRoles] = useState(true);
  const [partLoading, setPartLoading] = useState(false);
  const [partSaved, setPartSaved] = useState(false);
  const roleOptions = [
    { value: '', label: '— Nessun ruolo —' },
    { value: 'testimone-sposa', label: 'Testimone della sposa' },
    { value: 'testimone-sposo', label: 'Testimone dello sposo' },
    { value: 'padre', label: 'Padre' },
    { value: 'madre', label: 'Madre' },
    { value: 'amico', label: 'Amico' },
    { value: 'parente', label: 'Parente' },
    { value: 'altro', label: 'Altro' },
  ];

  // Dati separati dei due partner (richiesto dall'utente 27/07/2026 per supportare
  // matrimonio stesso-sesso e watermark con soli nomi). Default: 'groom' (neutro);
  // gli sposi specificano il ruolo corretto (es. una coppia eterosessuale metterà
  // partner1=bride + partner2=groom; una coppia stessa-sesso può mettere entrambi groom).
  type PartnerRole = 'groom' | 'bride';
  const [p1First, setP1First] = useState('');
  const [p1Last, setP1Last] = useState('');
  const [p1Role, setP1Role] = useState<PartnerRole>('groom');
  const [p2First, setP2First] = useState('');
  const [p2Last, setP2Last] = useState('');
  const [p2Role, setP2Role] = useState<PartnerRole>('groom');
  const [namesSaving, setNamesSaving] = useState(false);
  const [namesSaved, setNamesSaved] = useState(false);

  // I font vanno caricati anche nel browser per l'anteprima della scelta.
  // 1) Per i 7 font disponibili su Google Fonts: un singolo <link> CSS2.
  // 2) Per i restanti 21 font (non su Google Fonts): @font-face inline che referenzia
  //    i TTF locali in public/fonts/ (copiati anche in assets/fonts/ lato server).
  const googleFamilies = WATERMARK_FONTS
    .filter((f) => f.googleImport)
    .map((f) => `family=${f.googleImport}`)
    .join('&');
  const googleHref = googleFamilies
    ? `https://fonts.googleapis.com/css2?${googleFamilies}&display=swap`
    : '';
  // Stringa CSS @font-face per i font locali (TTF in public/fonts/). Ogni font
  // carica il proprio TTF con display=swap, fall-back a Georgia/serif.
  const localFontFaces = WATERMARK_FONTS
    .filter((f) => !f.googleImport && f.ttfFile)
    .map((f) => {
      // Encoda gli SPAZI nel filename URL (es. "Agetya Butterfly Demo.ttf")
      const urlSafe = f.ttfFile!.replace(/ /g, '%20');
      return `@font-face{font-family:${f.family};src:url('/fonts/${urlSafe}') format('truetype');font-display:swap;}`;
    })
    .join('\n');
  const localFontsStyle = localFontFaces
    ? `/* 21 watermark font locali non disponibili su Google Fonts */\n${localFontFaces}`
    : '';

  const eleganti = WATERMARK_FONTS.filter((f) => f.category === 'elegante');
  const classici = WATERMARK_FONTS.filter((f) => f.category === 'classico');

  const classicoEntry = WATERMARK_FONTS.find((f) => f.value === 'classico');
  const currentFont =
    WATERMARK_FONTS.find((f) => f.value === wmFont) ?? classicoEntry ?? WATERMARK_FONTS[0]!;
  const currentFamilyCss = `${currentFont.family}, Georgia, serif`;

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/details`)
      .then((r) => (r.ok ? r.json() : { event: null }))
      .then((d) => {
        if (!d.event || !d.isCreator) { router.push(`/events/${eventId}`); return; }
        setEvent(d.event);
        setWmNames(d.event.watermark_names !== false);
        setWmText(d.event.watermark_text || '');
        setWmFont((d.event as { watermark_font?: string }).watermark_font || 'classico');
        const ev = d.event as typeof d.event & {
          groom1_first_name?: string | null; groom1_last_name?: string | null;
          groom1_role?: PartnerRole | null; groom2_first_name?: string | null;
          groom2_last_name?: string | null; groom2_role?: PartnerRole | null;
        };
        setP1First(ev.groom1_first_name || '');
        setP1Last(ev.groom1_last_name || '');
        setP1Role((ev.groom1_role as PartnerRole) || 'groom');
        setP2First(ev.groom2_first_name || '');
        setP2Last(ev.groom2_last_name || '');
        setP2Role((ev.groom2_role as PartnerRole) || 'groom');
        setLoading(false);
      })
      .catch(() => router.push(`/events/${eventId}`));

    fetch(`/api/events/${eventId}/participants`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setParticipants(d.participants ?? []);
        setShowRoles(d.show_uploader_roles !== false);
      })
      .catch(() => { /* sezione opzionale: se fallisce non blocchiamo le impostazioni */ });
  }, [eventId, router]);

  const saveWatermark = async () => {
    setWmSaving(true);
    setWmSaved(false);
    const { error } = await updateEventWatermark(eventId, {
      watermark_names: wmNames,
      watermark_text: wmText,
      watermark_font: wmFont,
    });
    setWmSaving(false);
    if (!error) { setWmSaved(true); setTimeout(() => setWmSaved(false), 3000); }
    else alert(`Salvataggio non riuscito: ${error}`);
  };

  const saveNames = async () => {
    setNamesSaving(true);
    setNamesSaved(false);
    const { updateEventNames } = await import('@fotosposi/events');
    const { error } = await updateEventNames(eventId, {
      groom1_first_name: p1First.trim() || null,
      groom1_last_name: p1Last.trim() || null,
      groom1_role: p1Role,
      groom2_first_name: p2First.trim() || null,
      groom2_last_name: p2Last.trim() || null,
      groom2_role: p2Role,
    });
    setNamesSaving(false);
    if (!error) { setNamesSaved(true); setTimeout(() => setNamesSaved(false), 3000); }
    else alert(`Salvataggio non riuscito: ${error}`);
  };

  const saveParticipantRole = async (userId: string, roleAtEvent: string | null) => {
    const res = await fetch(`/api/events/${eventId}/participants`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, roleAtEvent }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(`Salvataggio ruolo non riuscito: ${(d as { error?: string }).error ?? res.status}`);
      return;
    }
    setParticipants((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, role_at_event: roleAtEvent } : p)),
    );
    setPartSaved(true);
    setTimeout(() => setPartSaved(false), 3000);
  };

  const toggleShowRoles = async (value: boolean) => {
    setShowRoles(value);
    const res = await fetch(`/api/events/${eventId}/participants`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showUploaderRoles: value }),
    });
    if (!res.ok) setShowRoles(!value);
  };

  if (loading || !event) return (
    <main className="max-w-2xl mx-auto p-4 flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-6 h-6 animate-spin text-brand" />
    </main>
  );

  const previewText = wmText || event.couple_name || 'Giulia & Marco';

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Pre-caricamento font per l'anteprima UI:
          - 7 famiglie su Google Fonts (link CSS2)
          - 21 font locali (TTF in public/fonts/) via @font-face inline */}
      {googleHref && (
        // eslint-disable-next-line @next/next/no-page-custom-font
        <link rel="stylesheet" href={googleHref} />
      )}
      {localFontsStyle && (
        <style dangerouslySetInnerHTML={{ __html: localFontsStyle }} />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" /> Impostazioni</h1>
        <Button variant="ghost" onClick={() => router.push(`/events/${eventId}`)}>← Torna all'evento</Button>
      </div>

      {/* Dati dei partner (separati per supportare matrimonio stesso-sesso) */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Dati degli sposi</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-text-muted">
            Inserisci nome e cognome di ciascun partner: verranno usati dal watermark su foto e video.
            Termini neutri (sposo/sposo o sposa/sposa) per supportare qualsiasi tipo di unione.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Partner 1 */}
            <div className="space-y-2 border border-border rounded-md p-3 bg-background">
              <p className="text-xs uppercase tracking-wide text-text-muted">Partner 1</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={p1First}
                  onChange={(e) => setP1First(e.target.value)}
                  placeholder="Nome"
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                />
                <input
                  type="text"
                  value={p1Last}
                  onChange={(e) => setP1Last(e.target.value)}
                  placeholder="Cognome"
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  <input type="radio" checked={p1Role === 'groom'} onChange={() => setP1Role('groom')} />
                  <span>Sposo</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={p1Role === 'bride'} onChange={() => setP1Role('bride')} />
                  <span>Sposa</span>
                </label>
              </div>
            </div>
            {/* Partner 2 */}
            <div className="space-y-2 border border-border rounded-md p-3 bg-background">
              <p className="text-xs uppercase tracking-wide text-text-muted">Partner 2</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={p2First}
                  onChange={(e) => setP2First(e.target.value)}
                  placeholder="Nome"
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                />
                <input
                  type="text"
                  value={p2Last}
                  onChange={(e) => setP2Last(e.target.value)}
                  placeholder="Cognome"
                  className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  <input type="radio" checked={p2Role === 'groom'} onChange={() => setP2Role('groom')} />
                  <span>Sposo</span>
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={p2Role === 'bride'} onChange={() => setP2Role('bride')} />
                  <span>Sposa</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveNames} disabled={namesSaving}>
              {namesSaving ? 'Salvataggio...' : 'Salva dati sposi'}
            </Button>
            {namesSaved && <span className="text-sm text-success">Salvato ✓</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Watermark su foto e video</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={wmNames} onChange={(e) => setWmNames(e.target.checked)} />
            Vuoi che nelle foto e nei video ci siano impressi i Vostri nomi?
          </label>

          {wmNames && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">Scegli un suggerimento o scrivi il testo che preferisci:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  [event.couple_name, 'Sposi', event.location, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' '),
                  [event.couple_name, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' — '),
                  ['W gli Sposi!', event.couple_name, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' '),
                ].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setWmText(s)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${wmText === s ? 'border-brand bg-brand/10 font-medium' : 'border-border bg-background hover:border-brand/50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                maxLength={80}
                placeholder={`es. ${event.couple_name} Sposi ${event.location} ${new Date(event.date).toLocaleDateString('it-IT')}`}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              />

              {/* ─── MENU A TENDINA FONT con ogni voce renderizzata col proprio font ───
                  Native <select> NON può stilare singole option, quindi costruisco un
                  dropdown custom. Ogni voce mostra il nome del font scritto col font
                  stesso: l'utente vede in tempo reale come apparirà. */}
              <p className="text-xs text-text-muted mt-3">Scegli il carattere ({WATERMARK_FONTS.length} disponibili):</p>

              <details className="border border-border rounded-md bg-background">
                <summary className="cursor-pointer px-3 py-2 flex items-center justify-between text-sm">
                  <span className="text-text-muted">Carattere selezionato:</span>
                  <span
                    className="text-lg leading-snug"
                    style={{ fontFamily: currentFamilyCss }}
                  >
                    {currentFont.label}
                  </span>
                </summary>
                <div className="border-t border-border max-h-72 overflow-y-auto py-2">
                  <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-text-muted">Eleganti</p>
                  {eleganti.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => { setWmFont(f.value); (document.activeElement as HTMLElement)?.blur(); }}
                      className={`w-full text-left px-3 py-2 text-lg flex items-center justify-between gap-3 hover:bg-muted ${wmFont === f.value ? 'bg-brand/10' : ''}`}
                      style={{ fontFamily: `${f.family}, Georgia, serif` }}
                    >
                      <span>{f.label}</span>
                      <span className="text-text-muted text-sm">{f.value === wmFont ? '✓' : ''}</span>
                    </button>
                  ))}
                  <p className="px-3 py-1 mt-2 text-[10px] uppercase tracking-wide text-text-muted">Classici</p>
                  {classici.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => { setWmFont(f.value); (document.activeElement as HTMLElement)?.blur(); }}
                      className={`w-full text-left px-3 py-2 text-lg flex items-center justify-between gap-3 hover:bg-muted ${wmFont === f.value ? 'bg-brand/10' : ''}`}
                      style={{ fontFamily: `${f.family}, Georgia, serif` }}
                    >
                      <span>{f.label}</span>
                      <span className="text-text-muted text-sm">{f.value === wmFont ? '✓' : ''}</span>
                    </button>
                  ))}
                </div>
              </details>

              {/* ─── Anteprima frase col font scelto ─── */}
              <div className="mt-4 p-4 bg-background border border-border rounded-md">
                <p className="text-xs text-text-muted mb-2">Anteprima del tuo watermark</p>
                <p
                  className="text-2xl text-text"
                  style={{ fontFamily: currentFamilyCss }}
                >
                  {previewText}
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-text-muted">Il logo Sposi.live appare in alto a destra in trasparenza 60%.</p>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveWatermark} disabled={wmSaving}>
              {wmSaving ? 'Salvataggio...' : 'Salva'}
            </Button>
            {wmSaved && <span className="text-sm text-success">Salvato ✓</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Partecipanti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-text-muted">
            Chi carica foto o video del vostro matrimonio. Assegnate un ruolo: in galleria
            apparirà solo per Testimone della sposa, Testimone dello sposo, Padre e Madre —
            gli altri ruoli restano salvati qui per organizzare la festa, ma non vengono mostrati.
          </p>

          <label className="flex items-center justify-between gap-3 border border-border rounded-md p-3 bg-background cursor-pointer">
            <span className="text-sm">Mostra il ruolo del caricatore in galleria</span>
            <input
              type="checkbox"
              checked={showRoles}
              onChange={(e) => toggleShowRoles(e.target.checked)}
              className="w-5 h-5 accent-brand"
            />
          </label>

          {participants.length === 0 ? (
            <p className="text-sm text-text-muted">
              {partLoading ? 'Caricamento...' : 'Nessun partecipante ancora: quando gli invitati caricheranno foto o video li troverete qui.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {participants.map((p) => {
                const isCustom = p.role_at_event && !roleOptions.some((o) => o.value === p.role_at_event);
                return (
                  <div key={p.user_id} className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-md p-3 bg-background">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-text-muted truncate">
                        {p.email ?? '—'} · {p.media_count} {p.media_count === 1 ? 'media' : 'media'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={p.role_at_event ?? ''}
                        onChange={(e) => saveParticipantRole(p.user_id, e.target.value || null)}
                        className="rounded-md border border-border px-2 py-1 text-sm bg-background"
                      >
                        {roleOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                        {isCustom && <option value={p.role_at_event!}>{p.role_at_event} (personalizzato)</option>}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {partSaved && <p className="text-sm text-success">Salvato ✓</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Altre impostazioni</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/guests`}><Users className="w-4 h-4 mr-2" /> Invitati e accessi</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/privacy`}><Shield className="w-4 h-4 mr-2" /> Privacy</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/notifications`}><Bell className="w-4 h-4 mr-2" /> Notifiche</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/drive`}><HardDrive className="w-4 h-4 mr-2" /> Backup Google Drive</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/site-builder`}><Globe className="w-4 h-4 mr-2" /> Sito degli sposi</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/tier`}>⭐ Piano evento (Free/Premium)</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
