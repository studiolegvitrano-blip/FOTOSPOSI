// stress-test-agenti/index.js
// Orchestratore: 1 sposo + N invitati concorrenti.
// - Lo sposo: login → /events/new → crea evento "Anna & Marco, 26/07/2026" → scarica/simula QR
//   (genera token via service role) → attende fine setup.
// - Gli invitati (N, default 9): concurrenti → ognuno fa login con credenziali pre-create
//   (invite flow bypass: Admin API crea user + core_users.role='invitato' legato a event_id
//   del sposo) → naviga a /event/<qr_token> → click "Carica" → upload 5 foto + 2 video.
//
// Sintassi:
//   node index.js --url=http://localhost:3000 --guests=9 --photos=5 --videos=2 [--headed] [--dryRun]

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const argv = require('minimist')(process.argv.slice(2));

const BASE_URL = argv.url || process.env.STRESS_BASE_URL || 'http://localhost:3000';
const GUESTS = parseInt(argv.guests || '9', 10);
const PHOTOS = parseInt(argv.photos || '5', 10);
const VIDEOS = parseInt(argv.videos || '2', 10);
const HEADLESS = !(argv.headed || false);
const DRY_RUN = !!(argv.dryRun || false);

function ensureDirs() {
  ['reports', 'logs'].forEach((d) => {
    const p = path.join(__dirname, d);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
}

function makeEmail(prefix) {
  return `${prefix}+${crypto.randomUUID()}@example.test`;
}

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

loadEnv();

async function main() {
  ensureDirs();
  const eventStartTime = Date.now();
  const runStamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logPath = path.join(__dirname, 'logs', `run-${runStamp}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  const scenario = DRY_RUN ? 'DRY-RUN (1 sposo + 1 invitato)' : `FULL (1 sposo + ${GUESTS} invitati)`;

  console.log('=== Sposi.live Stress Test — Scenario sposo+invitati ===');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Scenario: ${scenario} (headless=${HEADLESS})`);
  console.log(`Per-invitato: ${PHOTOS} foto + ${VIDEOS} video`);
  console.log('');

  const agentModule = require('./agent');
  const browser = await chromium.launch({ headless: HEADLESS });

  // Carica la lib Supabase admin per pre-creare gli utenti invitati (l'orchestratore lo fa,
  // non gli agenti, così l'agent invitato non ragiona di auth API ma solo di UI flow).
  const { createClient } = require('@supabase/supabase-js');
  const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ----------------- FASE 1: SPOSO (sequenziale, prereq per gli invitati) -----------------
  const sposoEmail = makeEmail('stress-sposo');
  const sposoResult = await agentModule.runAgent({
    browser,
    index: 0,
    role: 'sposo',
    baseUrl: BASE_URL,
    photos: 0,
    videos: 0,
    logStream,
    email: sposoEmail,
    supabaseAdmin, // passed-in: l'agent lo usa per auto-setup di core_tenants + core_users
    coupleName: 'Anna & Marco',
    eventDate: '2026-07-26',
    watermarkFont: 'great_vibes',
  });

  if (!sposoResult.success) {
    console.error('Sposo FAIL — stress test abortito');
    console.error(JSON.stringify(sposoResult, null, 2));
    fs.writeFileSync(
      path.join(__dirname, 'reports', `run-${runStamp}.json`),
      JSON.stringify({ abortReason: 'sposo_failed', sposoResult }, null, 2),
    );
    await browser.close();
    process.exit(2);
  }

  const eventId = sposoResult.eventId;
  const qrToken = sposoResult.qrToken;
  const tenantId = sposoResult.tenantId;
  console.log(`Sposo OK — eventId=${eventId} qrToken=${qrToken ? qrToken.substring(0, 8) + '...' : 'NONE'}`);

  // ----------------- FASE 2: INVITATI (concurrent fan-out) -----------------
  const guestCount = DRY_RUN ? 1 : GUESTS;
  const guestCredentials = [];
  for (let i = 0; i < guestCount; i++) {
    const email = makeEmail(`stress-inv${i}`);
    const password = `StressA1${Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, 'x')}`;
    guestCredentials.push({ email, password, index: i + 1 });
  }

  // Pre-crea gli utenti invitati via admin API prima del fan-out, così gli agenti possono
  // concentrarsi solo sul browser flow senza race condition auth.
  for (const gc of guestCredentials) {
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
      email: gc.email,
      password: gc.password,
      email_confirm: true,
      user_metadata: { name: `Stress Invitato${gc.index}`, source: 'stress-test-guest' },
    });
    if (error) {
      console.error(`createUser invitato ${gc.index} FAIL: ${error.message}`);
      process.exit(3);
    }
    const uid = u.user.id;
    const { error: userErr } = await supabaseAdmin.from('core_users').insert({
      id: uid,
      email: gc.email,
      name: `Stress Invitato${gc.index}`,
      first_name: 'Stress',
      last_name: `Invitato${gc.index}`,
      phone: '+39 3331234567',
      gdpr_consent_at: new Date().toISOString(),
      marketing_consent: false,
      role: 'invitato',
      tenant_id: tenantId,
      event_id: eventId,
    });
    if (userErr && !String(userErr.message || '').includes('duplicate')) {
      console.error(`core_users invitato ${gc.index} FAIL: ${userErr.message}`);
    }
    gc.uid = uid;
  }
  console.log(`Pre-creati ${guestCount} utenti invitati. Fan-out browser concorrente...`);

  // Fan-out: tutti gli invitati navigano contemporaneamente.
  const guestResults = await Promise.allSettled(
    guestCredentials.map((gc) =>
      agentModule.runAgent({
        browser,
        index: gc.index,
        role: 'invitato',
        baseUrl: BASE_URL,
        photos: PHOTOS,
        videos: VIDEOS,
        logStream,
        email: gc.email,
        password: gc.password,
        qrToken,
        eventId,
        supabaseAdmin,
      }),
    ),
  );

  // ----------------- REPORT -----------------
  const okGuests = guestResults.filter((r) => r.status === 'fulfilled' && r.value.success).length;
  const errGuests = guestResults.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
  const latencies = guestResults
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value.durationMs)
    .sort((a, b) => a - b);
  const p = (q) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] : 0);

  const summary = {
    runStamp,
    baseUrl: BASE_URL,
    scenario: 'sposo+invitati',
    sposoEmail,
    guests: guestCount,
    photosPerGuest: PHOTOS,
    videosPerGuest: VIDEOS,
    sposoSuccess: sposoResult.success,
    sposoDurationMs: sposoResult.durationMs,
    eventId,
    qrToken,
    guestSuccess: okGuests,
    guestFailure: errGuests,
    uploadsAttempted: guestResults.reduce((acc, r) => acc + (r.status === 'fulfilled' ? r.value.uploadsAttempted : 0), 0),
    uploadsSucceeded: guestResults.reduce((acc, r) => acc + (r.status === 'fulfilled' ? r.value.uploadsSucceeded : 0), 0),
    p50: p(0.5),
    p95: p(0.95),
    p99: p(0.99),
    totalDurationMs: Date.now() - eventStartTime,
    guestErrors: guestResults
      .filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
      .map((r) => (r.status === 'rejected' ? r.reason : r.value?.error)),
  };
  fs.writeFileSync(
    path.join(__dirname, 'reports', `run-${runStamp}.json`),
    JSON.stringify(summary, null, 2),
  );

  console.log('');
  console.log('=== Risultati ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Log completo: ${logPath}`);

  await browser.close();
}

main().catch((e) => {
  console.error('Errore fatale:', e);
  process.exit(1);
});
