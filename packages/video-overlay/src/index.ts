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
}

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
    const bandHeight = 140;
    const textColor = branding.textColor || '#ffffff';

    const svg = `<svg width="${width}" height="${bandHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${bandHeight}" fill="${branding.primaryColor}" fill-opacity="0.85" />
      <text x="32" y="${bandHeight / 2 - 6}" font-family="${branding.fontFamily || 'Georgia, serif'}"
            font-size="38" font-weight="bold" fill="${textColor}">${escapeXml(branding.coupleNames)}</text>
      <text x="32" y="${bandHeight / 2 + 34}" font-family="${branding.fontFamily || 'Georgia, serif'}"
            font-size="26" fill="${textColor}" fill-opacity="0.9">${escapeXml(branding.date)}</text>
      <text x="${width - 32}" y="${bandHeight / 2 + 4}" font-family="Inter, sans-serif"
            font-size="20" fill="${textColor}" fill-opacity="0.6"
            text-anchor="end">${escapeXml(branding.wordmark)}</text>
    </svg>`;

    const overlayPng = await sharp(Buffer.from(svg)).png().toBuffer();
    await writeFile(overlayPath, overlayPng);

    await run(bin, [
      '-y',
      '-i', inputPath,
      '-i', overlayPath,
      '-filter_complex',
      `[0:v]scale=${width}:-2[base];[base][1:v]overlay=0:main_h-overlay_h`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ]);

    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
