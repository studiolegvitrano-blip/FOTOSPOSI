// vps-scripts/overlay.js
// Modulo CJS standalone per il rendering del watermark video (striscia testo con
// cuore + logo brand alto-dx + logo partner alto-sx) e l'esecuzione di ffmpeg.
// ALLINEATO ALLO STILE FOTO (sessione 09/2026): niente banda colorata, testo
// trasparente con colore adattivo (bianco su scuro, nero su chiaro), cuore rosso
// PNG inline, logo brand in alto a destra (separato dalla striscia), logo partner
// in alto a sinistra, font custom opzionale via @font-face base64.
//
// Se packages/video-overlay cambia la grafica, va ricopiato qui a mano.
// Dipendenze: Node 18+, sharp (npm installato sul VPS), ffmpeg di sistema.

const { spawn } = require('child_process');
const { writeFile } = require('fs/promises');

// Cuore rosso 200x200 PNG (stesso di packages/photo-overlay/src/heart-png.ts).
// Renderizzato come <image href="data:image/png;base64,..."> dentro l'SVG.
const HEART_PNG_BASE64 =
  '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';

/** Escape XML per evitare xmlParseEntityRef sui nomi sposo con '&' o '<'. */
function escapeXml(s) {
  const AMP = String.fromCharCode(38) + 'amp;';
  const LT = String.fromCharCode(38) + 'lt;';
  const GT = String.fromCharCode(38) + 'gt;';
  const QUOT = String.fromCharCode(38) + 'quot;';
  return String(s)
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT);
}

function escapeXmlAttr(s) {
  return escapeXml(s);
}

/** True se un colore hex (#rrggbb) è chiaro (luminanza percepite > 0.5). */
function isHexLight(hex) {
  if (typeof hex !== 'string') return false;
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  // luma percepite (sRGB)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

function runFfmpeg(args) {
  return run('ffmpeg', args);
}

/**
 * Estrae il primo frame del video come PNG grezzo per campionare la luminanza
 * della fascia bassa (stessa logica di packages/photo-overlay). Restituisce
 * un valore 0..1 (0 = nero, 1 = bianco). In caso di errore ritorna 0.5
 * (scuro → testo bianco, safe default).
 */
async function probeLuminance(filePath, targetWidth) {
  return new Promise((resolve) => {
    const sharp = require('sharp');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tmpFrame = path.join(os.tmpdir(), `fotosposi-frame-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
    const proc = spawn('ffmpeg', [
      '-y', '-ss', '0', '-i', filePath,
      '-frames:v', '1', '-f', 'image2', tmpFrame,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', async (code) => {
      if (code !== 0) {
        try { fs.unlinkSync(tmpFrame); } catch {}
        return resolve(0.5);
      }
      try {
        const meta = await sharp(tmpFrame).metadata();
        const w = meta.width || targetWidth || 1080;
        const h = meta.height || 1920;
        const stripH = Math.max(1, Math.floor(h * 0.25));
        const top = Math.max(0, h - stripH);
        const stats = await sharp(tmpFrame)
          .extract({ left: 0, top, width: Math.min(w, meta.width || w), height: stripH })
          .resize(64, 16, { fit: 'fill' })
          .greyscale()
          .raw()
          .toBuffer({ resolveWithObject: true });
        const channels = stats.info.channels || 1;
        const data = stats.data;
        let sum = 0;
        const n = Math.floor(data.length / channels);
        for (let i = 0; i < n; i++) sum += data[i * channels];
        const mean = sum / n;
        resolve(mean / 255);
      } catch (err) {
        resolve(0.5);
      } finally {
        try { fs.unlinkSync(tmpFrame); } catch {}
      }
    });
    proc.on('error', () => resolve(0.5));
  });
}

function probeDuration(filePath) {
  return new Promise((resolve) => {
    const p = spawn('ffmpeg', ['-i', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    p.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (!m) return resolve(null);
      const [, h, min, s] = m;
      resolve(Number(h) * 3600 + Number(min) * 60 + Number(s));
    });
    p.on('error', () => resolve(null));
  });
}

/**
 * Render del logo brand (alto a destra, A COLORI) come PNG trasparente.
 * ALLINEATO ALLE FOTO (09/2026): larghezza ~20% della larghezza video
 * (clamp 120-500px), aspect ratio preservato — stessa scala relativa del
 * logo foto (25.5% width). Non ritorna mai null: se logoPng manca o è
 * malformato ritorna null (il server non passa l'input a ffmpeg).
 */
async function renderBrandLogo(outPath, brandLogoPng, targetWidth) {
  if (!brandLogoPng) return null;
  const sharp = (await import('sharp')).default;
  try {
    const logoW = Math.min(500, Math.max(120, Math.round(targetWidth * 0.2)));
    const logo = await sharp(brandLogoPng).resize({ width: logoW, fit: 'inside' }).png().toBuffer();
    await writeFile(outPath, logo);
    return outPath;
  } catch (err) {
    console.warn('[overlay] brand logo malformato, procedo senza:', err.message);
    return null;
  }
}

/**
 * Render del logo partner (B2B white label) come PNG trasparente, speculare al
 * logo brand (alto a sinistra). Stessa scala: larghezza ~20% del frame
 * (clamp 120-500px), aspect ratio preservato. Ritorna null se manca/malformato.
 */
async function renderPartnerLogo(outPath, partnerLogoPng, targetWidth) {
  if (!partnerLogoPng) return null;
  const sharp = (await import('sharp')).default;
  try {
    const partnerW = Math.min(500, Math.max(120, Math.round((targetWidth || 1080) * 0.2)));
    const partnerLogo = await sharp(partnerLogoPng).resize({ width: partnerW, fit: 'inside' }).png().toBuffer();
    await writeFile(outPath, partnerLogo);
    return outPath;
  } catch (err) {
    console.warn('[overlay] partner logo malformato, procedo senza:', err.message);
    return null;
  }
}

/**
 * Render della striscia testo watermark (TRASPARENTE, senza banda colorata) con:
 *   - Nomi sposi separati da cuore rosso (PNG inline, stesso di photo-overlay)
 *   - Colore testo adattivo (bianco su scuro, nero su chiaro) — passato dal caller
 *     via textColor, o calcolato dal caller via probeLuminance
 *   - Opacità 50%
 *   - Font custom opzionale via @font-face base64 (branding.fontBase64)
 *   - Altezza striscia proporzionale alla larghezza video (per leggibilità)
 *
 * Il caller (video-watermark-server.js) posiziona questa striscia in basso al
 * frame via ffmpeg overlay=0:main_h-overlay_h. I loghi (brand/partner) sono
 * PNG separati compositati in alto (non in questa striscia).
 *
 * @param {string} outPath path del PNG di output
 * @param {{ coupleNames: string, date?: string, primaryColor?: string, textColor?: string, wordmark?: string, fontFamily?: string, fontBase64?: string }} branding
 * @param {{ width: number, textColor?: string }} opts
 */
async function renderWatermarkOverlay(outPath, branding, opts) {
  const sharp = (await import('sharp')).default;
  const width = (opts && opts.width) || 1080;
  const textColor = (opts && opts.textColor) || branding.textColor || '#ffffff';

  // Altezza striscia: proporzionale alla larghezza per leggibilità su 720/1080
  const stripH = Math.round(width * 0.13); // 720→94, 1080→140

  // Monogramma: "Name1 ❤ Name2" splittato sul cuore (unicode U+2764, senza VS16)
  const RAW_HEART = '\u2764';
  const VARIANT_SELECTOR = '\ufe0f';
  const cleanText = (branding.coupleNames || '').split(VARIANT_SELECTOR).join('');
  const segments = cleanText.split(RAW_HEART).map((s) => s.trim()).filter((s) => s.length > 0);

  // Se non ci sono nomi, striscia vuota (niente testo) — resta solo il wordmark
  // minuscolo in basso a destra come fallback (come photo-overlay quando no nomi).
  const hasNames = segments.length > 0;
  const hasFontBase64 = !!(branding.fontBase64);
  const requestedFamily = branding.fontFamily || 'Georgia, serif';
  const resolvedFontFamily = hasFontBase64
    ? `'WatermarkEmbeddedFont', ${escapeXmlAttr(requestedFamily)}`
    : escapeXmlAttr(requestedFamily);
  const fontFaceDefs = hasFontBase64
    ? `<defs><style>@font-face { font-family: 'WatermarkEmbeddedFont'; src: url(data:font/ttf;base64,${branding.fontBase64}) format('truetype'); }</style></defs>`
    : '';

  // Dimensione testo: ~3.6% della dimensione MINORE della striscia (width è la
  // limitante per testo orizzontale), clampato 18-36px su 720, 24-48 su 1080.
  const minDim = Math.min(width, stripH * 4); // heuristica: testo largo ma non troppo
  const basePx = Math.min(48, Math.max(20, Math.round(width * 0.04)));
  const textPx = Math.round(basePx * 1.75);
  const heartSize = textPx;
  const padBottom = Math.round(stripH * 0.08);
  const padLeft = Math.round(width * 0.02);
  const baselineY = stripH - padBottom;

  // Stima larghezza monogramma per safety check (char-width ~0.55)
  const CHAR_WIDTH = textPx * 0.55;
  let monoWidth = 0;
  for (let i = 0; i < segments.length; i++) {
    monoWidth += (segments[i] || '').length * CHAR_WIDTH;
    if (i < segments.length - 1) monoWidth += heartSize; // cuore quadrato
  }

  // Scaling: se il monogramma è più largo del maxWidth, riduci textPx
  const SIDE_PADDING = Math.round(width * 0.02);
  const maxWidth = width - 2 * SIDE_PADDING;
  let actualTextPx = textPx;
  let actualPadLeft = padLeft;
  while (monoWidth > maxWidth && actualTextPx > 14) {
    actualTextPx = Math.round(actualTextPx * 0.9);
    actualPadLeft = Math.min(actualPadLeft, SIDE_PADDING);
    const factor = actualTextPx / textPx;
    monoWidth = 0;
    for (let i = 0; i < segments.length; i++) {
      monoWidth += (segments[i] || '').length * CHAR_WIDTH * factor;
      if (i < segments.length - 1) monoWidth += heartSize * factor;
    }
  }

  // Colore testo adattivo (bianco/nero) passato dal caller. Per video la luminanza
  // può variare (primo frame ≠ scene successive): per garantire leggibilità su QUALSIASI
  // sfondo aggiungiamo un contorno di colore OPPOSTO (rim scuro se testo bianco, chiaro
  // se testo nero). Più opacità (0.9, non 0.5) — altrimenti testo bianco ~96% opaco su
  // fondo chiaro del video risultava INVISIBILE (bug ripple 11/09/2026).
  const isLightText = isHexLight(textColor);
  const strokeColor = isLightText ? '#000000' : '#ffffff';
  const strokeWidth = Math.max(1, Math.round(actualTextPx * 0.1));

  // Costruisci SVG: sfondo TRASPARENTE (niente <rect> di sfondo). Testo in basso
  // a sinistra con cuore PNG inline e contorno di contrasto (leggibile ovunque).
  let svgParts = [];
  if (hasNames) {
    let cursorX = actualPadLeft;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i] || '';
      if (seg.length > 0) {
        svgParts.push(
          `<text x="${cursorX.toFixed(1)}" y="${baselineY}" font-family="${resolvedFontFamily}" font-size="${actualTextPx}" fill="${textColor}" fill-opacity="0.9" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-opacity="0.65" paint-order="stroke fill" font-weight="500">${escapeXml(seg)}</text>`,
        );
      }
      cursorX += seg.length * (actualTextPx * 0.55);
      if (i < segments.length - 1) {
        // Cuore PNG inline alla stessa altezza del testo (quadrato come glifo)
        const heartTopY = baselineY - actualTextPx;
        svgParts.push(
          `<image x="${cursorX.toFixed(1)}" y="${heartTopY.toFixed(1)}" width="${(actualTextPx * 0.7).toFixed(1)}" height="${(actualTextPx * 0.7).toFixed(1)}" preserveAspectRatio="none" href="data:image/png;base64,${HEART_PNG_BASE64}"/>`,
        );
        cursorX += actualTextPx * 0.7;
      }
    }
  }

  // Wordmark fallback (se non ci sono nomi): testo piccolo in basso a destra
  if (!hasNames && branding.wordmark) {
    svgParts.push(
      `<text x="${width - SIDE_PADDING}" y="${baselineY}" font-family="Inter, sans-serif" font-size="${Math.round(actualTextPx * 0.6)}" fill="${textColor}" fill-opacity="0.9" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-opacity="0.65" paint-order="stroke fill" text-anchor="end">${escapeXml(branding.wordmark)}</text>`,
    );
  }

  const svg = `<svg width="${width}" height="${stripH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${fontFaceDefs}
    ${svgParts.join('\n    ')}
  </svg>`;

  let overlayPng = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(outPath, overlayPng);
}

module.exports = {
  renderWatermarkOverlay,
  renderBrandLogo,
  renderPartnerLogo,
  runFfmpeg,
  probeDuration,
  probeLuminance,
  escapeXml,
};
