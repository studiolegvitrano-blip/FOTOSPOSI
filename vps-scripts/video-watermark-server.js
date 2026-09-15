// vps-scripts/video-watermark-server.js
// Sidecar per la lambda Vercel: riceve POST /watermark con due presigned URL
// (download originale + upload watermarkato) piu' branding, scarica → ffmpeg
// composita il watermark PNG sul video → upload.mp4 H.264 + faststart.
//
// ALLINEATO ALLO STILE FOTO (sessione 09/2026): niente banda colorata, testo
// trasparente con cuore rosso, colore adattivo (bianco/nero) campionato dal
// primo frame, logo brand in alto a destra, logo partner in alto a sinistra.
//
// MODALITA' ASYNC (14/09/2026) — solidità per 250 matrimoni × 200 invitati:
// il modo sincrono forzava la lambda Vercel ad attendere la fine dell'encode
// entro il proxy_read_timeout nginx (300s) e il maxDuration lambda (300s):
// i video lunghi (encode >300s) fallivano SEMPRE. Ora il client puo' passare
// `async: true`: il server accoda il job, risponde SUBITO 202 {jobId} e il
// client fa polling su GET /jobs/:id. Se la lambda scade prima della fine,
// l'item di coda conserva il jobId (upload_queue.video_job_id) e la run
// successiva riprende il polling SENZA ri-encodare. Max N encode in parallelo
// (MAX_CONCURRENT, default 2) per non saturare CPU/disco del VPS.
//
// Protocollo async:
//   POST /watermark {downloadUrl, uploadUrl, branding, async: true}
//     → 202 {ok:true, jobId}
//   GET /jobs/:jobId
//     → {ok:true, status:'queued'|'running'|'done'|'error'|'not_found',
//        bytes?, durationMs?, error?}
//   (not_found = job sconosciuto/scaduto → il client re-invia il job)
//
// Retrocompatibilita': senza `async:true` il comportamento e' identico a prima
// (risposta solo a encode completato).
//
// Dipendenze: Node 18+, ffmpeg di sistema, npm install sharp.
// Avvio: API_KEY=$(openssl rand -hex 32) PORT=8081 MAX_CONCURRENT=2 node video-watermark-server.js

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { mkdtemp, readFile, rm, writeFile } = require('fs/promises');
const { tmpdir } = require('os');
const { join } = require('path');
const os = require('os');

const {
  renderWatermarkOverlay,
  renderBrandLogo,
  renderPartnerLogo,
  runFfmpeg,
  probeDuration,
  probeLuminance,
} = require('./overlay.js');

const PORT = parseInt(process.env.PORT || '8081', 10);
const API_KEY = process.env.API_KEY;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '2', 10);
const JOB_TTL_MS = parseInt(process.env.JOB_TTL_MS || String(60 * 60 * 1000), 10);

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

function readBody(req, maxBytes = 256 * 1024 * 1024) {
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

/**
 * Esegue UN job watermark end-to-end: download → probe → render overlay + logo
 * → encode ffmpeg → upload del risultato sul presigned PUT.
 * Ritorna {bytes, durationMs, skipped?}; lancia Error in caso di fallimento
 * (il chiamante — handler sync o worker async — decide come mapparlo).
 */
async function runWatermarkJob(params) {
  const { downloadUrl, uploadUrl, branding, maxDurationSeconds } = params;
  const t0 = Date.now();
  const dir = await mkdtemp(join(tmpdir(), 'fotosposi-vps-'));
  const inputPath = join(dir, 'in.mp4');
  const overlayPath = join(dir, 'overlay.png');
  const outputPath = join(dir, 'out.mp4');
  const brandLogoPath = join(dir, 'brand-logo.png');
  const partnerLogoPath = join(dir, 'partner-logo.png');

  try {
    // 1) Download video da R2 via presigned GET
    const dlStart = Date.now();
    const dlResp = await fetch(downloadUrl);
    if (!dlResp.ok) throw new Error(`Download failed: HTTP ${dlResp.status}`);
    const dlBuffer = Buffer.from(await dlResp.arrayBuffer());
    console.log(`[${new Date().toISOString()}] download bytes=${dlBuffer.length} dlMs=${Date.now() - dlStart}`);
    await writeFile(inputPath, dlBuffer);

    // 2) Salva logo brand e partner se presenti
    let brandLogoBuffer;
    if (branding.logoBase64) {
      brandLogoBuffer = Buffer.from(branding.logoBase64, 'base64');
    }
    let partnerLogoBuffer;
    if (branding.partnerLogoBase64) {
      partnerLogoBuffer = Buffer.from(branding.partnerLogoBase64, 'base64');
    }

    // 3) Probe durata (opzionale skip se > maxDurationSeconds)
    if (maxDurationSeconds && maxDurationSeconds > 0) {
      const dur = await probeDuration(inputPath);
      if (dur !== null && dur > maxDurationSeconds) {
        console.log(`[${new Date().toISOString()}] duration ${dur}s exceeds ${maxDurationSeconds}s, skipping watermark`);
        const ulResp = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'video/mp4' },
          body: dlBuffer,
        });
        if (!ulResp.ok) throw new Error(`Upload skipped original failed: HTTP ${ulResp.status}`);
        return { bytes: dlBuffer.length, durationMs: Date.now() - t0, skipped: true };
      }
    }

    // 4) Probe luminanza del primo frame per scegliere colore testo adattivo
    //    (bianco su scuro, nero su chiaro) — stesso approccio di photo-overlay.
    const TARGET_WIDTH = 1080;
    let textColor = '#ffffff'; // safe default (scuro)
    try {
      const luma = await probeLuminance(inputPath, TARGET_WIDTH);
      textColor = luma < 0.5 ? '#ffffff' : '#000000';
      console.log(`[${new Date().toISOString()}] probeLuminance luma=${luma.toFixed(3)} textColor=${textColor}`);
    } catch (lumaErr) {
      console.warn(`[${new Date().toISOString()}] probeLuminance fallito, uso default #ffffff:`, lumaErr instanceof Error ? lumaErr.message : lumaErr);
    }

    // 5) Render striscia testo watermark (TRASPARENTE, no banda, cuore, colore adattivo)
    const overlayStart = Date.now();
    await renderWatermarkOverlay(overlayPath, branding, { width: TARGET_WIDTH, textColor });
    console.log(`[${new Date().toISOString()}] overlay renderMs=${Date.now() - overlayStart}`);

    // 6) Render logo brand (alto a destra) e partner (alto a sinistra)
    const renderedBrandLogo = await renderBrandLogo(brandLogoPath, brandLogoBuffer, TARGET_WIDTH);
    const renderedPartnerLogo = await renderPartnerLogo(partnerLogoPath, partnerLogoBuffer, TARGET_WIDTH);

    // 7) ffmpeg composita: scale 1080 + overlay testo in basso + logo brand alto-dx + logo partner alto-sx
    //    Encoding settings: crf 26, preset medium, maxrate 2.5M, +faststart (qualità migliore del
    //    fallback locale che usa crf 30 veryfast — il VPS ha tempo/CPU sufficienti).
    const encodeStart = Date.now();
    const ffmpegArgs = [
      '-y',
      '-i', inputPath,
      '-i', overlayPath,
      ...(renderedBrandLogo ? ['-i', renderedBrandLogo] : []),
      ...(renderedPartnerLogo ? ['-i', renderedPartnerLogo] : []),
      '-filter_complex',
      buildFilterComplex(!!renderedBrandLogo, !!renderedPartnerLogo),
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
    await runFfmpeg(ffmpegArgs);
    const outBuffer = await readFile(outputPath);
    console.log(`[${new Date().toISOString()}] ffmpeg encodeMs=${Date.now() - encodeStart} outBytes=${outBuffer.length}`);

    // 8) Upload watermarkato a R2 via presigned PUT
    const ulStart = Date.now();
    const ulResp = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body: outBuffer,
    });
    if (!ulResp.ok) throw new Error(`Upload failed: HTTP ${ulResp.status} ${await ulResp.text().catch(() => '')}`);
    console.log(`[${new Date().toISOString()}] upload uploadMs=${Date.now() - ulStart}`);

    return { bytes: outBuffer.length, durationMs: Date.now() - t0 };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Coda job interna (in-memory). Il jobId e' persistito anche lato DB
 * (upload_queue.video_job_id) dal client Vercel: se il VPS riavvia e perde
 * i job, il client vede status='not_found' e re-invia un nuovo job.
 */
const jobs = new Map(); // jobId -> {status, params, result?, error?, createdAt, startedAt?, finishedAt?}
const pendingQueue = [];
let runningJobs = 0;

function gcJobs() {
  const now = Date.now();
  for (const [id, j] of jobs) {
    if ((j.status === 'done' || j.status === 'error') && j.finishedAt && now - j.finishedAt > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

function pumpJobs() {
  while (runningJobs < MAX_CONCURRENT && pendingQueue.length > 0) {
    const id = pendingQueue.shift();
    const job = jobs.get(id);
    if (!job || job.status !== 'queued') continue;
    job.status = 'running';
    job.startedAt = Date.now();
    runningJobs++;
    console.log(`[${new Date().toISOString()}] job ${id} start (running=${runningJobs}, queued=${pendingQueue.length})`);
    runWatermarkJob(job.params)
      .then((result) => {
        job.status = 'done';
        job.result = result;
        console.log(`[${new Date().toISOString()}] job ${id} done bytes=${result.bytes} durationMs=${result.durationMs}`);
      })
      .catch((err) => {
        job.status = 'error';
        job.error = err instanceof Error ? err.message : String(err);
        console.error(`[${new Date().toISOString()}] job ${id} ERROR:`, job.error);
      })
      .finally(() => {
        job.finishedAt = Date.now();
        runningJobs--;
        pumpJobs();
        gcJobs();
      });
  }
}

function enqueueJob(params) {
  const jobId = crypto.randomUUID();
  jobs.set(jobId, { status: 'queued', params, createdAt: Date.now() });
  pendingQueue.push(jobId);
  pumpJobs();
  return jobId;
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
  const { downloadUrl, uploadUrl, branding } = body;
  if (!downloadUrl || !uploadUrl || !branding) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'downloadUrl, uploadUrl, branding required' }));
    return;
  }

  // Modalita' ASYNC: accoda e rispondi subito. Il client fa polling su
  // GET /jobs/:jobId — nessun limite di durata della risposta HTTP.
  if (body.async === true) {
    const jobId = enqueueJob({
      downloadUrl,
      uploadUrl,
      branding,
      maxDurationSeconds: body.maxDurationSeconds,
    });
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, jobId }));
    return;
  }

  // Modalita' SYNC (retrocompatibile): risponde solo a lavoro completato.
  try {
    const result = await runWatermarkJob(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, bytes: result.bytes, durationMs: result.durationMs, ...(result.skipped ? { skipped: true } : {}) }));
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

function handleJobStatus(req, res, jobId) {
  const authHeader = req.headers['x-api-key'];
  if (!authHeader || !timingSafeEqualStr(String(authHeader), API_KEY)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }
  const job = jobs.get(jobId);
  if (!job) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status: 'not_found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ok: true,
    status: job.status,
    ...(job.result ? { bytes: job.result.bytes, durationMs: job.result.durationMs } : {}),
    ...(job.error ? { error: job.error } : {}),
    queued: pendingQueue.length,
    running: runningJobs,
  }));
}

/**
 * Costruisce la stringa filter_complex di ffmpeg.
 * Input 0 = video. Input 1 = overlay striscia testo (trasparente).
 * Input 2 (opzionale) = logo brand. Input 3 (opzionale) = logo partner.
 *
 * Posizionamenti:
 *   - Striscia testo: bottom, overlay=0:main_h-overlay_h (centrata in orizzontale)
 *   - Logo brand: top-right, overlay=main_w-overlay_w-24:24
 *   - Logo partner: top-left, overlay=24:24
 */
function buildFilterComplex(hasBrand, hasPartner) {
  // FIX 12/09/2026: ogni overlay intermedio deve avere UN LABEL; solo l'ULTIMO
  // overlay della catena termina SENZA label così ffmpeg lo auto-mappa al file
  // di output. Prima: senza logo (no brand/no partner) la catena terminava con
  // "[wm]" mai consumato -> "Filter overlay has an unconnected output".
  let filter = '[0:v]scale=1080:-2[base];[base][1:v]overlay=0:main_h-overlay_h';
  if (hasBrand || hasPartner) filter += '[wm]';
  if (hasBrand) filter += ';[wm][2:v]overlay=main_w-overlay_w-24:24[wb]';
  if (hasPartner) {
    const idx = hasBrand ? 3 : 2;
    const src = hasBrand ? 'wb' : 'wm';
    filter += `;[${src}][${idx}:v]overlay=24:24`;
  } else if (hasBrand) {
    // brand è l'ultimo: togli il label [wb] residuo -> auto-map finale
    filter = filter.replace('[wb]', '');
  }
  return filter;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/watermark') {
    return handleWatermark(req, res);
  }
  const jobMatch = req.method === 'GET' && req.url ? req.url.match(/^\/jobs\/([0-9a-f-]{36})$/) : null;
  if (jobMatch) {
    return handleJobStatus(req, res, jobMatch[1]);
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'fotosposi-watermark', uptime: process.uptime(), running: runningJobs, queued: pendingQueue.length, maxConcurrent: MAX_CONCURRENT }));
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
    console.log(`fotosposi-watermark sidecar in ascolto su :${PORT} (pid=${process.pid}, maxConcurrent=${MAX_CONCURRENT})`);
  });
})();

process.on('SIGTERM', () => {
  console.log('SIGTERM ricevuto, chiudo il server...');
  server.close(() => process.exit(0));
});
