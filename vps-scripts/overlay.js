// vps-scripts/overlay.js
// Modulo CJS standalone per il rendering del watermark PNG e l'esecuzione di ffmpeg.
// Ricalca packages/video-overlay/src/index.ts SENZA dipendere dal repo principale
// (niente TypeScript build, niente ffmpeg-static, niente import ESM): questo file
// vive sul VPS insieme a video-watermark-server.js. Se packages/video-overlay cambia
// la grafica del watermark, va ricopiato a mano qui (check rapido: cercare
// "bandHeight" o "primaryColor" in entrambi i file e confrontare).
//
// Tutte le funzioni qui sotto usano API Node 18+:
//  - require('child_process').spawn per ffmpeg
//  - import dinamico di 'sharp' (deve essere npm installato sul VPS)

const { spawn } = require('child_process');

/** Escape XML per evitare xmlParseEntityRef sui nomi sposo con '&' o '<'.
 * Costruisce le entita' con String.fromCharCode per bypassare ogni sanitize editor. */
function escapeXml(s) {
  const AMP = String.fromCharCode(38) + 'amp;';   //  &  ->  &
  const LT = String.fromCharCode(38) + 'lt;';     //  <  ->  <
  const GT = String.fromCharCode(38) + 'gt;';     //  >  ->  >
  const QUOT = String.fromCharCode(38) + 'quot;';  //  "  ->  "
  return String(s)
    .replace(/&/g, AMP)
    .replace(/</g, LT)
    .replace(/>/g, GT)
    .replace(/"/g, QUOT);
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
 * Render del watermark in PNG (banda in basso o striscia sottile se nomi vuoti),
 * salva su `outPath`. Stesso schema di packages/video-overlay/src/index.ts:
 * - sharp render SVG → PNG (no drawtext ffmpeg, no system fonts required)
 * - eventuale logo brand compositato in overlay a destra
 *
 * @param {string} outPath path del PNG di output
 * @param {{ coupleNames: string, date: string, primaryColor: string, textColor?: string, wordmark: string, fontFamily?: string, logoPng?: Buffer }} branding
 */
async function renderWatermarkOverlay(outPath, branding) {
  const sharp = (await import('sharp')).default;
  const width = 1080;
  const textColor = branding.textColor || '#ffffff';
  const hasNames = !!(branding.coupleNames || branding.date);
  const bandHeight = hasNames ? 140 : 48;
  const hasLogo = !!branding.logoPng;

  function xmlBrandText() {
    if (hasNames) {
      const coupleY = branding.date ? bandHeight / 2 - 6 : bandHeight / 2 + 12;
      const svg = `<svg width="${width}" height="${bandHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${bandHeight}" fill="${branding.primaryColor}" fill-opacity="0.85" />
  <text x="32" y="${coupleY}" font-family="${branding.fontFamily || 'Georgia, serif'}"
        font-size="38" font-weight="bold" fill="${textColor}">${escapeXml(branding.coupleNames)}</text>
  <text x="32" y="${bandHeight / 2 + 34}" font-family="${branding.fontFamily || 'Georgia, serif'}"
        font-size="26" fill="${textColor}" fill-opacity="0.9">${escapeXml(branding.date)}</text>
  ${hasLogo ? '' : `<text x="${width - 32}" y="${bandHeight / 2 + 4}" font-family="Inter, sans-serif"
        font-size="20" fill="${textColor}" fill-opacity="0.6"
        text-anchor="end">${escapeXml(branding.wordmark)}</text>`}
</svg>`;
      return Buffer.from(svg);
    }
    const svg = `<svg width="${width}" height="${bandHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${bandHeight}" fill="#000000" fill-opacity="0.35" />
  ${hasLogo ? '' : `<text x="${width - 24}" y="${bandHeight / 2 + 8}" font-family="Inter, sans-serif"
        font-size="22" fill="${textColor}" fill-opacity="0.75"
        text-anchor="end">${escapeXml(branding.wordmark)}</text>`}
</svg>`;
    return Buffer.from(svg);
  }

  let overlayPng = await sharp(xmlBrandText()).png().toBuffer();
  if (hasLogo) {
    try {
      const logoH = Math.round(bandHeight * (hasNames ? 0.55 : 0.75));
      const logo = await sharp(branding.logoPng).resize({ height: logoH }).png().toBuffer();
      const logoMeta = await sharp(logo).metadata();
      overlayPng = await sharp(overlayPng)
        .composite([{
          input: logo,
          top: Math.round((bandHeight - logoH) / 2),
          left: width - (logoMeta.width || logoH) - 24,
        }])
        .png()
        .toBuffer();
    } catch (err) {
      console.warn('[overlay] logo malformato, restituisco banda senza logo:', err.message);
    }
  }
  const { writeFile } = require('fs/promises');
  await writeFile(outPath, overlayPng);
}

module.exports = { renderWatermarkOverlay, runFfmpeg, probeDuration, escapeXml };
