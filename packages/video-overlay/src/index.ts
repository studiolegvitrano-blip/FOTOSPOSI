import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface VideoOverlayBranding {
  coupleNames: string;
  date: string;
  primaryColor: string;
  textColor?: string;
  wordmark: string;
  fontFamily?: string;
  /** Bytes del TTF selezionato dagli sposi (embeddato via @font-face nell'SVG).
   *  Passato dal caller (process-queue.ts via loadWatermarkFontBuffer) per
   *  bypassare fontconfig di sistema (vedi bug 28/07/2026). Se assente,
   *  si usa il family testuale (meno affidabile ma non rompe). */
  fontBuffer?: Buffer | null;
  /** PNG del logo brand: compositato in alto a destra del frame. */
  logoPng?: Buffer;
  /** PNG del logo partner white label (B2B): compositato in ALTO A SINISTRA. */
  partnerLogoPng?: Buffer;
}

export { applyVideoOverlayRemote, isVpsWatermarkConfigured, VpsNotConfiguredError } from './remote';
export type { RemoteWatermarkRequest, RemoteWatermarkResponse } from './remote';

export interface VideoOverlayOptions {
  branding: VideoOverlayBranding;
  /** Skip processing (and just return the original buffer) if the source video is longer
   *  than this, to protect serverless function time limits. Default 90s. */
  maxDurationSeconds?: number;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeXmlAttr(s: string): string {
  return escapeXml(s);
}

function ffmpegBinaryPath(): string {
  // ffmpeg-static exports the absolute path to the platform binary. Kept as a require()
  // (not a static import) so bundlers/tracing pick up the binary as a runtime asset.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ffmpegStatic = require('ffmpeg-static') as string;
  return ffmpegStatic;
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function probeDuration(bin: string, filePath: string): Promise<number | null> {
  // ffmpeg-static ships only the ffmpeg binary (no ffprobe). We ask ffmpeg itself to
  // decode the header only (-t 0) and parse the "Duration:" line it prints to stderr.
  return new Promise((resolve) => {
    const proc = spawn(bin, ['-i', filePath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', () => {
      const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      if (!m) return resolve(null);
      const [, h, min, s] = m;
      resolve(Number(h) * 3600 + Number(min) * 60 + Number(s));
    });
    proc.on('error', () => resolve(null));
  });
}

/**
 * Estrae il primo frame del video come PNG grezzo e ne calcola la luminanza
 * della fascia bassa (stessa logica di photo-overlay). Restituisce 0..1
 * (0 = nero, 1 = bianco). In caso di errore ritorna 0.5 (scuro → testo bianco).
 */
async function probeLuminance(bin: string, filePath: string, targetWidth: number): Promise<number> {
  const sharp = (await import('sharp')).default;
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const tmpFrame = path.join(os.tmpdir(), `fotosposi-frame-${randomUUID()}.png`);
  return new Promise((resolve) => {
    const proc = spawn(bin, ['-y', '-ss', '0', '-i', filePath, '-frames:v', '1', '-f', 'image2', tmpFrame], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', async (code: number) => {
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
        for (let i = 0; i < n; i++) sum += data[i * channels] ?? 0;
        resolve(sum / n / 255);
      } catch {
        resolve(0.5);
      } finally {
        try { fs.unlinkSync(tmpFrame); } catch {}
      }
    });
    proc.on('error', () => resolve(0.5));
  });
}

/**
 * Render del logo brand come PNG trasparente (alto a destra, A COLORI).
 * ALLINEATO ALLE FOTO (09/2026): larghezza ~20% della larghezza video
 * (clamp 120-500px), aspect ratio preservato — stessa scala relativa del
 * logo foto (25.5% width). Ritorna null se logoPng manca o è malformato.
 */
async function renderBrandLogoPng(logoPng: Buffer, targetWidth: number): Promise<Buffer | null> {
  const sharp = (await import('sharp')).default;
  try {
    const logoW = Math.min(500, Math.max(120, Math.round(targetWidth * 0.2)));
    return await sharp(logoPng).resize({ width: logoW, fit: 'inside' }).png().toBuffer();
  } catch {
    return null;
  }
}

/**
 * Render del logo partner come PNG trasparente (alto a sinistra, A COLORI).
 * Stessa scala del logo brand (larghezza ~20% del frame, clamp 120-500px).
 * Speculare al logo brand.
 */
async function renderPartnerLogoPng(logoPng: Buffer, targetWidth: number): Promise<Buffer | null> {
  const sharp = (await import('sharp')).default;
  try {
    const logoW = Math.min(500, Math.max(120, Math.round(targetWidth * 0.2)));
    return await sharp(logoPng).resize({ width: logoW, fit: 'inside' }).png().toBuffer();
  } catch {
    return null;
  }
}

/**
 * Cuore rosso PNG 200x200 (stesso di packages/photo-overlay/src/heart-png.ts).
 * Renderizzato come <image href="data:image/png;base64,..."> nell'SVG.
 */
// Inline base64 per evitare dipendenza cross-package (video-overlay non
// dipende da photo-overlay a runtime). Costante identica a heart-png.ts.
const HEART_PNG_BASE64 =
  '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';

/**
 * Burns a branded watermark into a video, MATCHING the photo overlay style:
 *   - NO colored band — text is transparent overlay on the video frame
 *   - Couple names with red heart (PNG inline), bottom-left
 *   - Brand logo top-right (A COLORI, no opacity)
 *   - Partner logo top-left (A COLORI)
 *   - Adaptive text color (white on dark, black on light) probed from first frame
 *   - Custom font embedded via @font-face (if fontBuffer provided)
 *
 * Re-encodes to H.264/AAC MP4 with +faststart for universal playback.
 */
export async function applyVideoOverlay(
  inputBuffer: Buffer,
  options: VideoOverlayOptions,
): Promise<Buffer> {
  const { branding, maxDurationSeconds = 90 } = options;
  const sharp = (await import('sharp')).default;
  const bin = ffmpegBinaryPath();

  const dir = await mkdtemp(join(tmpdir(), 'fotosposi-video-'));
  const inputPath = join(dir, `in-${randomUUID()}`);
  const overlayPath = join(dir, `overlay-${randomUUID()}.png`);
  const brandLogoPath = join(dir, `brand-${randomUUID()}.png`);
  const partnerLogoPath = join(dir, `partner-${randomUUID()}.png`);
  const outputPath = join(dir, `out-${randomUUID()}.mp4`);

  try {
    await writeFile(inputPath, inputBuffer);

    const duration = await probeDuration(bin, inputPath);
    if (duration !== null && duration > maxDurationSeconds) {
      // Too long to safely re-encode inside a serverless request: return the
      // original untouched rather than risk a timeout/partial file.
      return inputBuffer;
    }

    const TARGET_WIDTH = 720;

    // Probe luminance del primo frame per scegliere colore testo adattivo
    let textColor = '#ffffff';
    try {
      const luma = await probeLuminance(bin, inputPath, TARGET_WIDTH);
      textColor = luma < 0.5 ? '#ffffff' : '#000000';
    } catch {
      // fallback safe: bianco su scuro
    }

    // Render striscia testo (trasparente, no banda, cuore, colore adattivo)
    const stripH = Math.round(TARGET_WIDTH * 0.13);
    const RAW_HEART = '\u2764';
    const VARIANT_SELECTOR = '\ufe0f';
    const cleanText = (branding.coupleNames || '').split(VARIANT_SELECTOR).join('');
    const segments = cleanText.split(RAW_HEART).map((s) => s.trim()).filter((s) => s.length > 0);
    const hasNames = segments.length > 0;

    // Font embedding via @font-face (bypass fontconfig)
    const hasFontBuffer = !!(branding.fontBuffer && branding.fontBuffer.length > 0);
    const requestedFamily = branding.fontFamily || 'Georgia, serif';
    const resolvedFontFamily = hasFontBuffer
      ? `'WatermarkEmbeddedFont', ${escapeXmlAttr(requestedFamily)}`
      : escapeXmlAttr(requestedFamily);
    const fontFaceDefs = hasFontBuffer
      ? `<defs><style>@font-face { font-family: 'WatermarkEmbeddedFont'; src: url(data:font/ttf;base64,${branding.fontBuffer!.toString('base64')}) format('truetype'); }</style></defs>`
      : '';

    const basePx = Math.min(48, Math.max(20, Math.round(TARGET_WIDTH * 0.04)));
    const textPx = Math.round(basePx * 1.75);
    const heartSize = Math.round(textPx * 0.7);
    const padBottom = Math.round(stripH * 0.08);
    const padLeft = Math.round(TARGET_WIDTH * 0.02);
    const baselineY = stripH - padBottom;

    const CHAR_WIDTH = textPx * 0.55;
    let monoWidth = 0;
    for (let i = 0; i < segments.length; i++) {
      monoWidth += (segments[i] || '').length * CHAR_WIDTH;
      if (i < segments.length - 1) monoWidth += heartSize;
    }

    const SIDE_PADDING = Math.round(TARGET_WIDTH * 0.02);
    const maxWidth = TARGET_WIDTH - 2 * SIDE_PADDING;
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

    let svgParts: string[] = [];
    let cursorX = actualPadLeft;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i] || '';
      if (seg.length > 0) {
        svgParts.push(
          `<text x="${cursorX.toFixed(1)}" y="${baselineY}" font-family="${resolvedFontFamily}" font-size="${actualTextPx}" fill="${textColor}" fill-opacity="0.5" font-weight="500">${escapeXml(seg)}</text>`,
        );
      }
      cursorX += seg.length * (actualTextPx * 0.55);
      if (i < segments.length - 1) {
        const heartTopY = baselineY - actualTextPx;
        svgParts.push(
          `<image x="${cursorX.toFixed(1)}" y="${heartTopY.toFixed(1)}" width="${heartSize}" height="${heartSize}" preserveAspectRatio="none" href="data:image/png;base64,${HEART_PNG_BASE64}"/>`,
        );
        cursorX += heartSize;
      }
    }

    if (!hasNames && branding.wordmark) {
      svgParts.push(
        `<text x="${TARGET_WIDTH - SIDE_PADDING}" y="${baselineY}" font-family="Inter, sans-serif" font-size="${Math.round(actualTextPx * 0.6)}" fill="${textColor}" fill-opacity="0.5" text-anchor="end">${escapeXml(branding.wordmark)}</text>`,
      );
    }

    const svg = `<svg width="${TARGET_WIDTH}" height="${stripH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      ${fontFaceDefs}
      ${svgParts.join('\n      ')}
    </svg>`;
    const overlayPng = await sharp(Buffer.from(svg)).png().toBuffer();
    await writeFile(overlayPath, overlayPng);

    // Render logo brand (alto a destra) e partner (alto a sinistra) come PNG separati
    let hasBrand = false;
    let hasPartner = false;
    if (branding.logoPng) {
      const brandBuf = await renderBrandLogoPng(branding.logoPng, TARGET_WIDTH);
      if (brandBuf) {
        await writeFile(brandLogoPath, brandBuf);
        hasBrand = true;
      }
    }
    if (branding.partnerLogoPng) {
      const partnerBuf = await renderPartnerLogoPng(branding.partnerLogoPng, TARGET_WIDTH);
      if (partnerBuf) {
        await writeFile(partnerLogoPath, partnerBuf);
        hasPartner = true;
      }
    }

    // ffmpeg composita: scale 720p + overlay striscia testo in basso + logo brand alto-dx + partner alto-sx
    // 33% qualità (09/08/2026): crf 30, preset veryfast, maxrate 1.5M — per stare dentro 90s su Vercel.
    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-i', overlayPath,
      ...(hasBrand ? ['-i', brandLogoPath] : []),
      ...(hasPartner ? ['-i', partnerLogoPath] : []),
      '-filter_complex',
      buildFilterComplex(hasBrand, hasPartner),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '30',
      '-maxrate', '1.5M',
      '-bufsize', '3M',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-movflags', '+faststart',
      outputPath,
    ];
    await run(bin, ffmpegArgs);

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Costruisce la stringa filter_complex di ffmpeg.
 * Input 0 = video. Input 1 = overlay striscia testo (trasparente).
 * Input 2 (opzionale) = logo brand. Input 3 (opzionale) = logo partner.
 * Striscia testo in basso, brand alto-dx, partner alto-sx.
 */
function buildFilterComplex(hasBrand: boolean, hasPartner: boolean): string {
  let filter = `[0:v]scale=720:-2[base];[base][1:v]overlay=0:main_h-overlay_h[wm]`;
  if (hasBrand) {
    filter += `;[wm][2:v]overlay=main_w-overlay_w-24:24[wm2]`;
  }
  if (hasPartner) {
    const idx = hasBrand ? 3 : 2;
    const src = hasBrand ? 'wm2' : 'wm';
    filter += `;[${src}][${idx}:v]overlay=24:24`;
  }
  return filter;
}

/**
 * Mapper VideoOverlayBranding (locale, con logoPng: Buffer) → RemoteBranding
 * (serializzabile via JSON, con logoBase64). Usato dalla route share prima di
 * chiamare applyVideoOverlayRemote. Se il logo manca o è malformato, ritorna
 * branding senza logo: il VPS userà il wordmark testuale come fallback.
 */
export function brandingToRemote(
  branding: VideoOverlayBranding,
): import('./remote').RemoteBranding {
  let logoBase64: string | undefined;
  let logoMimeType: string | undefined;
  if (branding.logoPng && branding.logoPng.length > 0) {
    logoBase64 = branding.logoPng.toString('base64');
    logoMimeType = 'image/png';
  }
  let partnerLogoBase64: string | undefined;
  let partnerLogoMimeType: string | undefined;
  if (branding.partnerLogoPng && branding.partnerLogoPng.length > 0) {
    partnerLogoBase64 = branding.partnerLogoPng.toString('base64');
    partnerLogoMimeType = 'image/png';
  }
  let fontBase64: string | undefined;
  if (branding.fontBuffer && branding.fontBuffer.length > 0) {
    fontBase64 = branding.fontBuffer.toString('base64');
  }
  return {
    coupleNames: branding.coupleNames,
    date: branding.date,
    primaryColor: branding.primaryColor,
    textColor: branding.textColor,
    wordmark: branding.wordmark,
    fontFamily: branding.fontFamily,
    fontBase64,
    logoBase64,
    logoMimeType,
    partnerLogoBase64,
    partnerLogoMimeType,
  };
}
