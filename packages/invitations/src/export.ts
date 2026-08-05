// Export della lista invitati: Word (.doc via HTML compatibile) e PDF
// (HTML print-friendly, stesso pattern di rsvp.ts/export playlist).
// feature 05/08/2026.

import type { InvitedGuest } from './service';

export interface InvitedListMeta {
  brand: 'Sposi.live' | 'JustMarry.live';
  coupleName: string;
  generatedAt: string;
  logoDataUri?: string | null;
  includeWhatsapp?: boolean;
}

const STATUS_LABEL: Record<InvitedGuest['status'], string> = {
  pending: 'Da confermare',
  confirmed: 'Confermato',
  declined: 'Non può',
};

const INSIST_LABEL: Record<InvitedGuest['insist_level'], string> = {
  low: 'Poco',
  medium: 'Medio',
  high: 'Insistere',
};

function escapeHtml(s: string): string {
  const AMP = String.fromCharCode(38);
  const LT = String.fromCharCode(60);
  const GT = String.fromCharCode(62);
  const QUOT = String.fromCharCode(34);
  return (s ?? '')
    .replace(new RegExp(AMP, 'g'), AMP + 'amp' + String.fromCharCode(59))
    .replace(new RegExp(LT, 'g'), AMP + 'lt' + String.fromCharCode(59))
    .replace(new RegExp(GT, 'g'), AMP + 'gt' + String.fromCharCode(59))
    .replace(new RegExp(QUOT, 'g'), AMP + 'quot' + String.fromCharCode(59));
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function buildRows(guests: InvitedGuest[], includeWhatsapp: boolean): string {
  return guests
    .map((g) => {
      const contact = g.email
        ? g.whatsapp && includeWhatsapp
          ? `${escapeHtml(g.email)}${' · '}${escapeHtml(g.whatsapp)}`
          : escapeHtml(g.email)
        : g.whatsapp && includeWhatsapp
          ? `WhatsApp: ${escapeHtml(g.whatsapp)}`
          : '—';
      const lastReminder = g.last_reminder_at ? formatDate(g.last_reminder_at) : '—';
      return `<tr>
        <td style="padding:8px 10px;border:1px solid #ddd;">${escapeHtml(g.name)}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;">${contact}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;">${INSIST_LABEL[g.insist_level]}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;">${STATUS_LABEL[g.status]}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;">${g.reminder_count}</td>
        <td style="padding:8px 10px;border:1px solid #ddd;">${lastReminder}</td>
      </tr>`;
    })
    .join('');
}

function buildCounts(guests: InvitedGuest[]) {
  const pending = guests.filter((g) => g.status === 'pending').length;
  const confirmed = guests.filter((g) => g.status === 'confirmed').length;
  const declined = guests.filter((g) => g.status === 'declined').length;
  return { total: guests.length, pending, confirmed, declined };
}

/**
 * HTML per la lista invitati in formato Word (.doc). Word apre senza problemi un
 * HTML con queste intestazioni; l'estensione .doc fa sì che si apra in Word e
 * sia stampabile/salvabile. Include tabelle con numeri + logo brand in testa.
 */
export function buildInvitedListWordHtml(guests: InvitedGuest[], meta: InvitedListMeta): string {
  const counts = buildCounts(guests);
  const logoHtml = meta.logoDataUri
    ? `<img src="${meta.logoDataUri}" style="height:46px;" />`
    : '';
  const today = meta.generatedAt ? new Date(meta.generatedAt).toLocaleDateString('it-IT') : '';
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /><title>Lista invitati — ${escapeHtml(meta.coupleName)}</title>
<style>body{font-family:Arial,sans-serif;color:#1a1a2e;} h1{font-size:20px;} table{border-collapse:collapse;width:100%;} th{background:#1a1a2e;color:#fff;padding:8px 10px;border:1px solid #333;text-align:left;}</style>
</head>
<body>
  <div>${logoHtml}</div>
  <h1>Lista invitati — ${escapeHtml(meta.coupleName)}</h1>
  <p>Generata il ${escapeHtml(today)} · ${escapeHtml(meta.brand)}</p>
  <p><strong>${counts.total}</strong> invitati · ${counts.pending} da confermare · ${counts.confirmed} confermati · ${counts.declined} non possono</p>
  <table>
    <tr>
      <th>Nome</th><th>Contatto</th><th>Insistenza</th><th>Stato</th><th>Solleciti inviati</th><th>Ultimo sollecito</th>
    </tr>
    ${buildRows(guests, meta.includeWhatsapp ?? true)}
  </table>
</body></html>`;
}

/**
 * CSV per Excel (separatore ; e BOM UTF-8 per aprire correttamente in Excel IT).
 * Colonne: Nome, Email, WhatsApp, Insistenza, Stato, Solleciti, Ultimo sollecito.
 */
export function buildInvitedListCsv(guests: InvitedGuest[], includeWhatsapp: boolean): string {
  const csvEscape = (v: string | number): string => {
    const s = String(v ?? '');
    return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    ['Nome', 'Email', 'WhatsApp', 'Insistenza', 'Stato', 'Solleciti inviati', 'Ultimo sollecito'].join(';'),
    ...guests.map((g) =>
      [
        csvEscape(g.name),
        csvEscape(g.email ?? ''),
        includeWhatsapp ? csvEscape(g.whatsapp ?? '') : '',
        INSIST_LABEL[g.insist_level],
        STATUS_LABEL[g.status],
        String(g.reminder_count),
        csvEscape(formatDate(g.last_reminder_at)),
      ].join(';'),
    ),
  ];
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * HTML print-friendly per PDF (stessa strategia di buildRsvpSummaryPdfHtml:
 * @page A4 + window.print). Table compatta, logo in testa.
 */
export function buildInvitedListPdfHtml(guests: InvitedGuest[], meta: InvitedListMeta): string {
  const counts = buildCounts(guests);
  const brandTag = meta.brand === 'JustMarry.live' ? 'JustMarry.live' : 'Sposi.live';
  const logoHtml = meta.logoDataUri
    ? `<img class="logo" src="${meta.logoDataUri}" alt="${escapeHtml(brandTag)}" />`
    : `<div class="brand-tag">${escapeHtml(brandTag)}</div>`;
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a2e; margin: 0; font-size: 13px; }
  .head { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #d4a574; padding-bottom: 12px; margin-bottom: 18px; }
  .logo { height: 46px; }
  .brand-tag { font-size: 20px; font-weight: 700; color: #1a1a2e; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #666; margin: 0 0 16px; font-size: 13px; }
  .counts { margin: 0 0 18px; }
  .counts strong { color: #b7791f; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a1a2e; color: #fff; padding: 7px 9px; text-align: left; font-size: 12px; }
  td { padding: 6px 9px; border-bottom: 1px solid #e2e2e2; }
  tr:nth-child(even) td { background: #f7f6f4; }
  .foot { margin-top: 20px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
</style>
</head>
<body>
  <div class="head">${logoHtml}<div class="brand-tag">${escapeHtml(brandTag)}</div></div>
  <h1>Lista invitati — ${escapeHtml(meta.coupleName)}</h1>
  <p class="sub">Generata il ${escapeHtml(meta.generatedAt ? new Date(meta.generatedAt).toLocaleDateString('it-IT') : '')}</p>
  <p class="counts"><strong>${counts.total}</strong> invitati · ${counts.pending} da confermare · ${counts.confirmed} confermati · ${counts.declined} non possono</p>
  <table>
    <tr>
      <th>Nome</th><th>Contatto</th><th>Insistenza</th><th>Stato</th><th>Solleciti</th><th>Ultimo sollecito</th>
    </tr>
    ${buildRows(guests, meta.includeWhatsapp ?? true)}
  </table>
  <p class="foot">Generato con ${escapeHtml(brandTag)}</p>
</body>
</html>`;
}
