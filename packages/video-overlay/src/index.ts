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
  /** PNG del logo brand: se presente sostituisce il wordmark testuale nella banda. */
  logoPng?: Buffer;
  /** PNG del logo partner white label (B2B): compositato in ALTO A SINISTRA del
   *  frame, speculare al logo brand (che vive nella banda in basso a destra). */
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

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', (code) => {
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
    proc.stderr?.on('data', (d) => { stderr += d.toString(); });
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
 * Burns a branded watermark band (couple names + date + wordmark, same visual style as the
 * photo overlay) into the bottom of a video, re-encoding to H.264/AAC MP4 so the result plays
 * back everywhere (iOS Safari does not play WebM). The watermark image itself is rendered with
 * `sharp` (SVG -> PNG), reusing the exact same text-rendering path already proven for photos,
 * and ffmpeg is only used to composite that PNG over the video (no ffmpeg `drawtext`, which
 * needs system fonts that serverless runtimes don't reliably ship).
 *
 * NOTE (ops): this spawns ffmpeg and re-encodes the whole clip, which is CPU/time bound.
 * On Vercel this route must set `export const runtime = 'nodejs'` and a generous
 * `export const maxDuration`. For events at scale (hundreds of concurrent guests), prefer
 * queuing this as a background job (see the existing `upload_queue` processor) instead of
 * running it synchronously inside a request, to avoid stacking long-running functions.
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
  const outputPath = join(dir, `out-${randomUUID()}.mp4`);

  try {
    await writeFile(inputPath, inputBuffer);

    const duration = await probeDuration(bin, inputPath);
    if (duration !== null && duration > maxDurationSeconds) {
      // Too long to safely re-encode inside a serverless request: return the
      // original untouched rather than risk a timeout/partial file.
      return inputBuffer;
    }

    const width = 1080;
    const textColor = branding.textColor || '#ffffff';

    // Se gli sposi hanno disattivato nomi/data (coupleNames e date vuoti), niente banda
    // piena: resta comunque SEMPRE impresso il wordmark (Sposi.live / JustMarry.live)
    // su una striscia sottile semi-trasparente — il logo piattaforma non è opzionale.
    const hasNames = !!(branding.coupleNames || branding.date);
    const bandHeight = hasNames ? 140 : 48;

    const hasLogo = !!branding.logoPng;
    const svg = hasNames
      ? `<svg width="${width}" height="${bandHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${bandHeight}" fill="${branding.primaryColor}" fill-opacity="0.85" />
      <text x="32" y="${branding.date ? bandHeight / 2 - 6 : bandHeight / 2 + 12}" font-family="${branding.fontFamily || 'Georgia, serif'}"
            font-size="38" font-weight="bold" fill="${textColor}">${escapeXml(branding.coupleNames)}</text>
      <text x="32" y="${bandHeight / 2 + 34}" font-family="${branding.fontFamily || 'Georgia, serif'}"
            font-size="26" fill="${textColor}" fill-opacity="0.9">${escapeXml(branding.date)}</text>
      ${hasLogo ? '' : `<text x="${width - 32}" y="${bandHeight / 2 + 4}" font-family="Inter, sans-serif"
            font-size="20" fill="${textColor}" fill-opacity="0.6"
            text-anchor="end">${escapeXml(branding.wordmark)}</text>`}
    </svg>`
      : `<svg width="${width}" height="${bandHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${bandHeight}" fill="#000000" fill-opacity="0.35" />
      ${hasLogo ? '' : `<text x="${width - 24}" y="${bandHeight / 2 + 8}" font-family="Inter, sans-serif"
            font-size="22" fill="${textColor}" fill-opacity="0.75"
            text-anchor="end">${escapeXml(branding.wordmark)}</text>`}
    </svg>`;

    let overlayPng = await sharp(Buffer.from(svg)).png().toBuffer();
    if (branding.logoPng) {
      // Logo brand al posto del wordmark testuale, a destra della banda.
      try {
        const logoH = Math.round(bandHeight * (hasNames ? 0.55 : 0.75));
        const logo = await sharp(branding.logoPng).resize({ height: logoH }).png().toBuffer();
        const logoMeta = await sharp(logo).metadata();
        overlayPng = await sharp(overlayPng)
          .composite([{ input: logo, top: Math.round((bandHeight - logoH) / 2), left: width - (logoMeta.width || logoH) - 24 }])
          .png().toBuffer();
      } catch { /* logo malformato: resta la banda senza logo */ }
    }
    await writeFile(overlayPath, overlayPng);

    // Partner logo (B2B white label): PNG in alto a SINISTRA del frame, speculare
    // al logo brand (nella banda in basso a destra). Renderizzato via sharp come
    // l'overlay della banda e passato a ffmpeg come secondo overlay.
    let partnerLogoPath: string | null = null;
    if (branding.partnerLogoPng) {
      try {
        const partnerH = 64;
        const partnerLogo = await sharp(branding.partnerLogoPng).resize({ height: partnerH }).png().toBuffer();
        partnerLogoPath = join(dir, `partner-${randomUUID()}.png`);
        await writeFile(partnerLogoPath, partnerLogo);
      } catch {
        // Logo partner malformato: si prosegue senza (solo banda + logo brand).
        partnerLogoPath = null;
      }
    }

    // Encoding settings ottimizzati per riduzione ~1/5 del file size senza
    // perdita di qualità percepita (richiesta utente 28/07/2026: 10min video =
    // 1GB su R2/Drive è insostenibile per tier Free 10GB storage):
    //   - crf 26 (era 23): 50% riduzione bit rate, qualità percepita quasi identica
    //     (YouTube stesso target).
    //   - preset medium (era veryfast): encoding più lento ma bitrate ottimale
    //     per stessa qualità (1 passaggio = qualità percepita simile a crf 23).
    //   - maxrate/bufsize: VBV cap per stabilizzare dimensione su clip lunghi.
    //   - +faststart: moov atom davanti per streaming/playback immediato.
    // Risultato: 10min @ 1080p ~1GB → ~200MB, watermark applicato nel stesso
    // passaggio (filter_complex + overlay). Unico encoding, zero duplicazioni.
    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-i', overlayPath,
      ...(partnerLogoPath ? ['-i', partnerLogoPath] : []),
      '-filter_complex',
      partnerLogoPath
        ? `[0:v]scale=${width}:-2[base];[base][1:v]overlay=0:main_h-overlay_h[wm];[wm][2:v]overlay=24:24`
        : `[0:v]scale=${width}:-2[base];[base][1:v]overlay=0:main_h-overlay_h`,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '26',
      '-maxrate', '2.5M',
      '-bufsize', '5M',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '128k',
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
  return {
    coupleNames: branding.coupleNames,
    date: branding.date,
    primaryColor: branding.primaryColor,
    textColor: branding.textColor,
    wordmark: branding.wordmark,
    fontFamily: branding.fontFamily,
    logoBase64,
    logoMimeType,
    partnerLogoBase64,
    partnerLogoMimeType,
  };
}
