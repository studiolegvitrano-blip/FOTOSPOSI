// Export playlist matrimonio: M3U + PDF (HTML print-friendly)
// M3U = formato testo standard per player; PDF = HTML via browser print.
// vedi feature "colonna sonora condivisa" 04/08/2026

import type { EventSong } from './service';

/**
 * Genera una playlist M3U (formato standard).
 * Estensione .m3u — prima riga #EXTM3U,.poi una coppia #EXTINF:<durata>,<title> - <artist>\n<url>
 * per ogni brano. Durata in secondi (NP se null).
 */
export function exportM3U(songs: EventSong[], playlistName = 'Playlist Matrimonio'): string {
  const lines: string[] = ['#EXTM3U'];
  if (playlistName) {
    lines.push(`# PLAYLIST: ${playlistName}`);
  }

  for (const s of songs) {
    const durSec = s.duration_ms != null ? Math.round(s.duration_ms / 1000) : -1;
    const title = s.title.replace(/\n/g, ' ');
    const artist = (s.artist ?? '').replace(/\n/g, ' ');
    lines.push(`#EXTINF:${durSec},${title} - ${artist}`);
    lines.push(s.external_url);
  }

  return lines.join('\n') + '\n';
}

/**
 * HTML print-friendly per PDF. Da renderizzare lato client (window.print() o html-pdf).
 * Stile "tracklist" elegante (matrimonio) — tipografia serif, righe alternate, header con nome playlist + count.
 */
export function buildPlaylistPdfHtml(
  songs: EventSong[],
  meta: { playlistName: string; coupleName: string; eventDate: string; brand: string },
): string {
  const title = meta.playlistName || 'Colonna Sonora del Matrimonio';
  const subtitle = [meta.coupleName, meta.eventDate].filter(Boolean).join(' — ');
  const brandTag = meta.brand === 'JustMarry.live' ? 'JustMarry.live' : 'Sposi.live';
  const count = songs.length;

  const rows = songs
    .map((s, i) => {
      const num = String(i + 1).padStart(2, '0');
      const title = escapeHtml(s.title);
      const artist = escapeHtml(s.artist);
      const album = s.album ? escapeHtml(s.album) : '';
      const dur = s.duration_ms != null ? formatDuration(s.duration_ms) : '';
      const addedBy = s.added_by_name ? `<span class="added">proposto da ${escapeHtml(s.added_by_name)}</span>` : '';
      return `<tr class="${i % 2 === 0 ? 'row-a' : 'row-b'}">
  <td class="num">${num}</td>
  <td class="art">${s.art_url ? `<img src="${escapeHtml(s.art_url)}" alt="" />` : ''}</td>
  <td class="meta">
    <div class="title">${title}</div>
    <div class="artist">${artist}${album ? ` <span class="album">· ${album}</span>` : ''}</div>
    ${addedBy}
  </td>
  <td class="dur">${dur}</td>
</tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — ${escapeHtml(meta.coupleName)}</title>
<style>
  @page { margin: 18mm 16mm; size: A4; }
  body { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; color: #1a1a2e; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cover { text-align: center; padding: 24mm 0 12mm; border-bottom: 1px solid #c4956a; }
  .brand-tag { font-size: 10pt; letter-spacing: 0.2em; text-transform: uppercase; color: #a87a4e; }
  h1 { font-size: 28pt; margin: 6mm 0 2mm; }
  .subtitle { font-size: 13pt; color: #6a5a48; }
  .count { font-size: 11pt; color: #a87a4e; margin-top: 2mm; }
  table { width: 100%; border-collapse: collapse; margin-top: 8mm; }
  tr { page-break-inside: avoid; }
  .num { width: 10mm; text-align: right; padding-right: 4mm; color: #a87a4e; font-size: 10pt; vertical-align: top; padding-top: 3mm; }
  .art { width: 14mm; vertical-align: top; padding-top: 2mm; }
  .art img { width: 11mm; height: 11mm; object-fit: cover; border-radius: 1mm; }
  .meta { padding-top: 2mm; padding-bottom: 3mm; }
  .title { font-size: 12pt; font-weight: 600; }
  .artist { font-size: 10.5pt; color: #444; margin-top: 0.5mm; }
  .album { color: #888; font-style: italic; }
  .added { display: block; font-size: 9pt; color: #a87a4e; margin-top: 0.6mm; font-style: italic; }
  .dur { width: 16mm; text-align: right; vertical-align: top; padding-top: 3mm; font-size: 10pt; color: #444; }
  .row-a { background: #faf8f3; }
  .row-b { background: #fff; }
  .footer { margin-top: 10mm; text-align: center; font-size: 9pt; color: #a87a4e; }
</style>
</head>
<body>
  <div class="cover">
    <div class="brand-tag">${escapeHtml(brandTag)}</div>
    <h1>${escapeHtml(title)}</h1>
    ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
    <div class="count">${count} brani</div>
  </div>
  <table>
    <tbody>
${rows}
    </tbody>
  </table>
  <div class="footer">Generato da ${escapeHtml(brandTag)} — ${new Date().toISOString().slice(0, 10)}</div>
</body>
</html>`;
}

/**
 * Wrapper — nome exported per coerenza con index.ts.
 */
export function exportPDFHtml(
  songs: EventSong[],
  meta: { playlistName: string; coupleName: string; eventDate: string; brand: string },
): string {
  return buildPlaylistPdfHtml(songs, meta);
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function escapeHtml(s: string): string {
  const LT = String.fromCharCode(60);
  const GT = String.fromCharCode(62);
  const QUOT = String.fromCharCode(34);
  const AMP = String.fromCharCode(38);
  const APOS = String.fromCharCode(39);
  const ENT_AMP  = String.fromCharCode(38) + 'amp' + String.fromCharCode(59);
  const ENT_LT   = String.fromCharCode(38) + 'lt'  + String.fromCharCode(59);
  const ENT_GT   = String.fromCharCode(38) + 'gt'  + String.fromCharCode(59);
  const ENT_QUOT = String.fromCharCode(38) + 'quot' + String.fromCharCode(59);
  const ENT_APOS = String.fromCharCode(38) + '#39' + String.fromCharCode(59);
  return (s ?? '')
    .replace(new RegExp(AMP, 'g'), ENT_AMP)
    .replace(new RegExp(LT, 'g'), ENT_LT)
    .replace(new RegExp(GT, 'g'), ENT_GT)
    .replace(new RegExp(QUOT, 'g'), ENT_QUOT)
    .replace(new RegExp(APOS, 'g'), ENT_APOS);
}
