// Lettera riepilogo RSVP per gli sposi: PDF (HTML print-friendly) con logo brand,
// numeri adulti/bambini, intolleranze e dettaglio per famiglia.
// Stessa strategia della playlist (buildPlaylistPdfHtml): HTML tipografico da
// aprire e stampare (window.print) → PDF. feature 05/08/2026.

export interface RsvpGuestRow {
  name: string;
  type: 'adult' | 'minor';
  age: number | null;
  intolerances: string[];
}

export interface RsvpSummaryEntry {
  id: string;
  host_name: string;
  host_intolerances: string[];
  guests: RsvpGuestRow[];
  message: string | null;
  created_at: string;
}

export interface RsvpSummaryMeta {
  brand: string;
  coupleName: string;
  generatedAt: string;
  logoDataUri?: string | null;
}

export interface RsvpSummaryNumbers {
  totalResponses: number;
  totalPeople: number;
  totalAdults: number;
  totalMinors: number;
  topIntolerances: Array<{ name: string; count: number }>;
}

function escapeHtml(s: string): string {
  const AMP = String.fromCharCode(38);
  const LT = String.fromCharCode(60);
  const GT = String.fromCharCode(62);
  const QUOT = String.fromCharCode(34);
  const ENT_AMP = AMP + 'amp' + String.fromCharCode(59);
  const ENT_LT = AMP + 'lt' + String.fromCharCode(59);
  const ENT_GT = AMP + 'gt' + String.fromCharCode(59);
  const ENT_QUOT = AMP + 'quot' + String.fromCharCode(59);
  return (s ?? '')
    .replace(new RegExp(AMP, 'g'), ENT_AMP)
    .replace(new RegExp(LT, 'g'), ENT_LT)
    .replace(new RegExp(GT, 'g'), ENT_GT)
    .replace(new RegExp(QUOT, 'g'), ENT_QUOT);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Costruisce la lettera "Cari sposi…" con il riepilogo delle conferme RSVP.
 * In testa il logo del brand (data URI base64, opzionale) + nome brand; poi
 * i numeri adulti/bambini, le intolleranze più segnalate con chi, il dettaglio
 * per famiglia e la chiusura "Grazie di aver scelto Sposi.live / JustMarry.live".
 */
export function buildRsvpSummaryPdfHtml(
  entries: RsvpSummaryEntry[],
  meta: RsvpSummaryMeta,
  numbers: RsvpSummaryNumbers,
): string {
  const brandTag = meta.brand === 'JustMarry.live' ? 'JustMarry.live' : 'Sposi.live';
  const couple = meta.coupleName || 'gli Sposi';

  const logoHtml = meta.logoDataUri
    ? `<img class="logo" src="${meta.logoDataUri}" alt="${escapeHtml(brandTag)}" />`
    : `<div class="brand-tag">${escapeHtml(brandTag)}</div>`;

  // Intolleranze aggregate "chi → intolleranza" (capofamiglia + accompagnatori)
  const intoleranceRows: string[] = [];
  for (const e of entries) {
    for (const it of Array.isArray(e.host_intolerances) ? e.host_intolerances : []) {
      intoleranceRows.push(`<li><strong>${escapeHtml(e.host_name)}</strong> — ${escapeHtml(it)}</li>`);
    }
    for (const g of Array.isArray(e.guests) ? e.guests : []) {
      for (const it of Array.isArray(g.intolerances) ? g.intolerances : []) {
        const who = `${e.host_name} (${g.name})`;
        intoleranceRows.push(`<li><strong>${escapeHtml(who)}</strong> — ${escapeHtml(it)}</li>`);
      }
    }
  }

  const intoleranceSection =
    intoleranceRows.length > 0
      ? `<h2>Intolleranze e allergie</h2>
  <ul class="intol">${intoleranceRows.join('\n')}</ul>`
      : `<h2>Intolleranze e allergie</h2><p class="none">Nessuna intolleranza segnalata.</p>`;

  // Dettaglio per famiglia
  const families = entries
    .map((e, idx) => {
      const guests = Array.isArray(e.guests) ? e.guests : [];
      const guestList = guests
        .map((g) => {
          const kind = g.type === 'minor' ? `bambino${g.age != null ? ` (${g.age} anni)` : ''}` : 'adulto';
          const intol =
            Array.isArray(g.intolerances) && g.intolerances.length > 0
              ? ` — intolleranze: ${g.intolerances.map(escapeHtml).join(', ')}`
              : '';
          return `<li>${escapeHtml(g.name)} · ${kind}${intol}</li>`;
        })
        .join('\n');
      const hostIntol =
        Array.isArray(e.host_intolerances) && e.host_intolerances.length > 0
          ? ` — intolleranze: ${e.host_intolerances.map(escapeHtml).join(', ')}`
          : '';
      const message = e.message ? `<p class="msg">“${escapeHtml(e.message)}”</p>` : '';
      return `<div class="family${idx % 2 === 0 ? ' alt' : ''}">
  <div class="family-head">
    <span class="host">${escapeHtml(e.host_name)}${hostIntol}</span>
    <span class="date">${formatDate(e.created_at)}</span>
  </div>
  ${guests.length > 0 ? `<ul class="guests">\n${guestList}\n</ul>` : ''}
  ${message}
</div>`;
    })
    .join('\n');

  const totalWord =
    numbers.totalPeople === 1 ? '1 persona' : `${numbers.totalPeople} persone`;
  const minorsWord =
    numbers.totalMinors === 1 ? '1 bambino' : `${numbers.totalMinors} bambini`;
  const adultsWord =
    numbers.totalAdults === 1 ? '1 adulto' : `${numbers.totalAdults} adulti`;

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>Riepilogo Conferme — ${escapeHtml(meta.coupleName)}</title>
<style>
  @page { margin: 18mm 16mm; size: A4; }
  body { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; color: #1a1a2e; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .letter { max-width: 170mm; margin: 0 auto; }
  .letterhead { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #c4956a; padding-bottom: 5mm; margin-bottom: 10mm; }
  .logo { height: 16mm; width: auto; object-fit: contain; }
  .brand-tag { font-size: 14pt; letter-spacing: 0.14em; text-transform: uppercase; color: #a87a4e; font-weight: 600; }
  .docdate { font-size: 9pt; color: #888; }
  h1 { font-size: 22pt; margin: 0 0 6mm; }
  .salutation { font-size: 13pt; margin: 0 0 4mm; }
  .intro { font-size: 12pt; color: #444; margin: 0 0 7mm; }
  .numbers { display: flex; gap: 6mm; flex-wrap: wrap; margin: 0 0 10mm; }
  .num-card { flex: 1; min-width: 32mm; background: #faf7f0; border: 1px solid #e7ddc9; border-radius: 3mm; padding: 5mm 4mm; text-align: center; }
  .num-card .value { font-size: 24pt; font-weight: 700; color: #a87a4e; }
  .num-card .label { font-size: 9pt; color: #6a5a48; margin-top: 1mm; text-transform: uppercase; letter-spacing: 0.08em; }
  h2 { font-size: 13pt; color: #a87a4e; margin: 0 0 3mm; text-transform: uppercase; letter-spacing: 0.06em; }
  ul.intol { margin: 0 0 8mm; padding-left: 5mm; font-size: 11pt; color: #333; }
  ul.intol li { margin-bottom: 1.2mm; }
  p.none { font-size: 11pt; color: #888; font-style: italic; margin: 0 0 8mm; }
  .family { border: 1px solid #e7ddc9; border-radius: 2mm; padding: 4mm 5mm; margin-bottom: 4mm; page-break-inside: avoid; }
  .family.alt { background: #faf7f0; }
  .family-head { display: flex; justify-content: space-between; align-items: baseline; gap: 3mm; margin-bottom: 2mm; }
  .host { font-size: 12pt; font-weight: 600; }
  .date { font-size: 8.5pt; color: #999; white-space: nowrap; }
  ul.guests { margin: 0; padding-left: 5mm; font-size: 10.5pt; color: #444; }
  ul.guests li { margin-bottom: 0.8mm; }
  p.msg { font-size: 10pt; color: #6a5a48; font-style: italic; margin: 2mm 0 0; }
  .closing { margin-top: 10mm; padding-top: 5mm; border-top: 2px solid #c4956a; text-align: center; }
  .closing .brand { font-size: 13pt; font-weight: 700; color: #a87a4e; letter-spacing: 0.08em; }
  .closing .sub { font-size: 9pt; color: #999; margin-top: 1.5mm; }
</style>
</head>
<body>
  <div class="letter">
    <div class="letterhead">
      ${logoHtml}
      <span class="docdate">Generato il ${formatDate(meta.generatedAt)}</span>
    </div>

    <h1>Cari Sposi,</h1>
    <p class="salutation">ad oggi le risposte ai vostri inviti sono:</p>

    <div class="numbers">
      <div class="num-card"><div class="value">${numbers.totalResponses}</div><div class="label">conferme</div></div>
      <div class="num-card"><div class="value">${numbers.totalPeople}</div><div class="label">${escapeHtml(totalWord)}</div></div>
      <div class="num-card"><div class="value">${numbers.totalAdults}</div><div class="label">${escapeHtml(adultsWord)}</div></div>
      <div class="num-card"><div class="value">${numbers.totalMinors}</div><div class="label">${escapeHtml(minorsWord)}</div></div>
    </div>

    ${intoleranceSection}

    <h2>Dettaglio per famiglia</h2>
    ${families || '<p class="none">Nessuna conferma ricevuta.</p>'}

    <div class="closing">
      <div class="brand">Grazie di aver scelto ${escapeHtml(brandTag)}</div>
      <div class="sub">Il team ${escapeHtml(brandTag)} · ${escapeHtml(couple)}</div>
    </div>
  </div>
</body>
</html>`;
}
