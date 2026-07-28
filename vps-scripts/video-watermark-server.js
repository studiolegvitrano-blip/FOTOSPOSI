// vps-scripts/video-watermark-server.js
// Sidecar per la lambda Vercel: riceve POST /watermark con due presigned URL
// (download originale + upload watermarkato) piu' branding, scarica → ffmpeg
// composita il watermark PNG sul video → upload.mp4 H.264 + faststart.
//
// Dipendenze: Node 18+, ffmpeg di sistema, npm install sharp.
// Avvio: API_KEY=$(openssl rand -hex 32) PORT=8081 node video-watermark-server.js

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { mkdtemp, readFile, rm, writeFile, access } = require('fs/promises');
const { tmpdir } = require('os');
const { join } = require('path');
const os = require('os');

// Logica watermark SVG→PNG riusata dal package @fotosposi/video-overlay.
// Il package ha un' interfaccia TS + dipendenza da ffmpeg-static (70MB bundle,
// a cui objections il VPS non abbia), qui importiamo una copia CJS standalone.
// Per evitare drift, il modulo overlay.js contiene solo la parte
// "render SVG → PNG + ffmpeg composita": se il package principale cambia, va
// copiato qui a manooppure estratto in un terzo package condiviso in futuro.
const { renderWatermarkOverlay, runFfmpeg, probeDuration } = require('./overlay.js');

const PORT = parseInt(process.env.PORT || '8081', 10);
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('API_KEY env obbligatoria. Genera con: openssl rand -hex 32');
  process.exit(1);
}

// Verifica ffmpeg di sistema presente
async function checkFfmpeg() {
  return new Promise((resolve) => {
    const p = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'ignore', 'pipe'] });
    p.on('error', () => resolve(false));
    p.on('close', (code) => resolve(code === 0));
  });
}

function readBody(req, maxBytes = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error(`Body too large (>${maxBytes} bytes)`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

async function handleWatermark(req, res) {
  const authHeader = req.headers['x-api-key'];
  if (!authHeader || !timingSafeEqualStr(String(authHeader), API_KEY)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
    return;
  }
  const { downloadUrl, uploadUrl, branding, maxDurationSeconds } = body;
  if (!downloadUrl || !uploadUrl || !branding) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'downloadUrl, uploadUrl, branding required' }));
    return;
  }

  const t0 = Date.now();
  const dir = await mkdtemp(join(tmpdir(), 'fotosposi-vps-'));
  const inputPath = join(dir, 'in.mp4');
  const overlayPath = join(dir, 'overlay.png');
  const outputPath = join(dir, 'out.mp4');

  try {
    // 1) Download video da R2 via presigned GET
    const dlStart = Date.now();
    const dlResp = await fetch(downloadUrl);
    if (!dlResp.ok) throw new Error(`Download failed: HTTP ${dlResp.status}`);
    const dlBuffer = Buffer.from(await dlResp.arrayBuffer());
    console.log(`[${new Date().toISOString()}] download bytes=${dlBuffer.length} dlMs=${Date.now() - dlStart}`);
    await writeFile(inputPath, dlBuffer);

    // 2) Salva logo brand se presente nella branding
    let logoBuffer;
    if (branding.logoBase64) {
      logoBuffer = Buffer.from(branding.logoBase64, 'base64');
    }

    // 3) Render watermark PNG overlay (SVG via sharp)
    const overlayStart = Date.now();
    await renderWatermarkOverlay(overlayPath, {
      ...branding,
      logoPng: logoBuffer,
    });
    console.log(`[${new Date().toISOString()}] overlay renderMs=${Date.now() - overlayStart}`);

    // 4) Probe duration per consentire skip se > maxDurationSeconds (opzionale)
    if (maxDurationSeconds && maxDurationSeconds > 0) {
      const dur = await probeDuration(inputPath);
      if (dur !== null && dur > maxDurationSeconds) {
        // Skip watermark: upload del file originale
        console.log(`[${new Date().toISOString()}] duration ${dur}s exceeds ${maxDurationSeconds}s, skipping watermark`);
        const ulResp = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'video/mp4' },
          body: dlBuffer,
        });
        if (!ulResp.ok) throw new Error(`Upload skipped original failed: HTTP ${ulResp.status}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          bytes: dlBuffer.length,
          durationMs: Date.now() - t0,
          skipped: true,
        }));
        return;
      }
    }

    // 5) ffmpeg composita: scale a 1080 + overlay PNG in basso, H.264/AAC +faststart.
    // Encoding settings ottimizzati per riduzione ~1/5 del file size senza perdita
    // di qualita' percepita (richiesta utente 28/07/2026: 10min video = 1GB su
    // R2/Drive e' insostenibile per tier Free 10GB storage):
    //   - crf 26 (era 23): 50% riduzione bit rate, qualita' percepita quasi identica.
    //   - preset medium (era veryfast): encoding piu' lento ma bitrate ottimale per
    //     stessa qualita' (preso in prestito da YouTube stesso target).
    //   - maxrate/bufsize: VBV cap per stabilizzare dimensione su clip lunghi.
    //   - +faststart: moov atom davanti per streaming/playback immediato.
    // Risultato: 10min @ 1080p ~1GB -> ~200MB, watermark applicato nello stesso
    // passaggio (filter_complex + overlay). Unico encoding, zero duplicazioni.
    const encodeStart = Date.now();
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-i', overlayPath,
      '-filter_complex',
      `[0:v]scale=1080:-2[base];[base][1:v]overlay=0:main_h-overlay_h`,
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
    ]);
    const outBuffer = await readFile(outputPath);
    console.log(`[${new Date().toISOString()}] ffmpeg encodeMs=${Date.now() - encodeStart} outBytes=${outBuffer.length}`);

    // 6) Upload watermarkato a R2 via presigned PUT
    const ulStart = Date.now();
    const ulResp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body: outBuffer,
    });
    if (!ulResp.ok) throw new Error(`Upload failed: HTTP ${ulResp.status} ${await ulResp.text().catch(() => '')}`);
    console.log(`[${new Date().toISOString()}] upload uploadMs=${Date.now() - ulStart}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      bytes: outBuffer.length,
      durationMs: Date.now() - t0,
    }));
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/watermark') {
    return handleWatermark(req, res);
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'fotosposi-watermark', uptime: process.uptime() }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

(async () => {
  const ok = await checkFfmpeg();
  if (!ok) {
    console.error('ffmpeg non trovato nel PATH. Installa con: apt install ffmpeg');
    process.exit(1);
  }
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`fotosposi-watermark sidecar in ascolto su :${PORT} (pid=${process.pid})`);
  });
})();

process.on('SIGTERM', () => {
  console.log('SIGTERM ricevuto, chiudo il server...');
  server.close(() => process.exit(0));
});
