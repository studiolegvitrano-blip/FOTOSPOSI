// Email di sollecito RSVP cordiale: QR code + link evento + slogan + logo brand.
// Il QR arriva come immagine (data URI generata server-side) — scelta utente
// 05/08/2026: QR come immagine PNG server-side, non link esterno.

export interface ReminderEventInfo {
  brand: 'Sposi.live' | 'JustMarry.live';
  coupleName: string;
  eventLink: string;
  qrDataUri: string;
  logoDataUri?: string | null;
  rsvpDeadline?: string | null;
  message?: string | null;
}

/** Slogan di default per brand (feature: sempre in fondo all'email). */
export const DEFAULT_SLOGAN: Record<ReminderEventInfo['brand'], string> = {
  'Sposi.live': 'Un matrimonio perfetto comincia da un sì.',
  'JustMarry.live': 'Every perfect wedding starts with a yes.',
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
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * HTML dell'email di sollecito RSVP. Toni cordiali ("Cari …", siamo solo noi),
 * messaggio custom opzionale dello sposo, link cliccabile + QR da scansionare,
 * chiusura con logo + slogan brand. Puro e testabile.
 */
export function buildReminderEmailHtml(guestName: string, event: ReminderEventInfo): string {
  const greeting = `Cari ${escapeHtml(guestName)},`;
  const defaultBody = `vi abbiamo inviato l'invito al matrimonio di ${escapeHtml(event.coupleName)} e non vogliamo farci sfuggire la vostra presenza! Ci farebbe davvero piacere sapere se potrete esserci.`;
  const deadline = formatDate(event.rsvpDeadline);
  const custom = event.message?.trim()
    ? `<p style="margin:14px 0;font-size:15px;line-height:1.6;">${escapeHtml(event.message.trim())}</p>`
    : '';

  const logoHtml = event.logoDataUri
    ? `<img src="${event.logoDataUri}" alt="${escapeHtml(event.brand)}" style="max-height:46px;margin-bottom:8px;" />`
    : `<div style="font-size:20px;font-weight:700;color:#1a1a2e;margin-bottom:8px;">${escapeHtml(event.brand)}</div>`;

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr><td style="padding:28px 32px;border-bottom:3px solid #d4a574;background:#ffffff;">
          ${logoHtml}
          <h1 style="margin:0;font-size:22px;line-height:1.3;">Il matrimonio di ${escapeHtml(event.coupleName)}</h1>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 6px;font-size:16px;font-weight:700;">${greeting}</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${defaultBody}</p>
          ${custom}
          ${deadline ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Vi chiediamo di rispondere entro il <strong>${escapeHtml(deadline)}</strong>.</p>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;">
            <tr>
              <td align="center" style="padding:12px;background:#f6f7fb;border-radius:10px;">
                <p style="margin:0 0 10px;font-size:13px;color:#555;">Potete confermare la presenza anche scansionando il QR:</p>
                <img src="${event.qrDataUri}" alt="QR code conferma presenza" width="150" height="150" style="width:150px;height:150px;border-radius:6px;" />
                <p style="margin:12px 0 0;font-size:13px;color:#555;word-break:break-all;">
                  oppure apri il link: <a href="${escapeHtml(event.eventLink)}" style="color:#d4a574;font-weight:700;">${escapeHtml(event.eventLink)}</a>
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#333;">Con tanto affetto,<br />${escapeHtml(event.coupleName)}</p>
        </td></tr>
        <tr><td align="center" style="padding:18px 32px;background:#1a1a2e;color:#ffffff;">
          <p style="margin:0;font-size:13px;color:#d4a574;font-weight:600;">${escapeHtml(DEFAULT_SLOGAN[event.brand])}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#bbbbbb;">${escapeHtml(event.brand)} · ricevi questa email perché sei nella lista invitati di ${escapeHtml(event.coupleName)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
