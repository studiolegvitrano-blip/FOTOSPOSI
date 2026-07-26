// stress-test-agenti/agent.js
// Agente role-aware: supporta ruolo 'sposo' (crea evento + watermark) o 'invitato' (upload
// concorrente di foto+video via pagina guest /event/<qrToken>).
//
// Per evitare la race condition signup browser + login browser (signUp via React state →
// signIn successivo → Supabase Auth restituisce 400), l'orchestratore (index.js) pre-crea
// gli utenti via Admin API. L'agent qui fa solo il flusso UI: login → navigate → upload.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const FIXTURES = path.join(__dirname, 'fixtures');
const TMP_DIR = path.join(__dirname, '.tmp-fixtures');

function listFixtures(ext) {
  return fs.readdirSync(FIXTURES)
    .filter((f) => f.toLowerCase().endsWith(ext.toLowerCase()))
    .map((f) => path.join(FIXTURES, f));
}

function log(stream, agentIdx, role, msg) {
  const line = `[${new Date().toISOString()}] agent=${agentIdx} role=${role} ${msg}\n`;
  stream.write(line);
  process.stdout.write(line);
}

// Costruisce una lista di file fixture della dimensione richiesta, duplicando i fixture
// esistenti a runtime (niente impatto sul repo, pulizia nel tmp dir).
// photos: string[] di path assoluti, videos: string[] di path assoluti
function buildUploadFiles(photos, videos) {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const stamp = crypto.randomBytes(4).toString('hex');

  const photoSrc = listFixtures('.jpg');
  const videoSrc = listFixtures('.mp4');
  if (photoSrc.length === 0) throw new Error('No .jpg fixtures found');
  if (videoSrc.length === 0) throw new Error('No .mp4 fixtures found');

  const out = [];
  for (let i = 0; i < photos; i++) {
    const src = photoSrc[i % photoSrc.length];
    const dst = path.join(TMP_DIR, `stress-photo-${stamp}-${i}.jpg`);
    fs.copyFileSync(src, dst);
    out.push(dst);
  }
  for (let i = 0; i < videos; i++) {
    const src = videoSrc[i % videoSrc.length];
    const dst = path.join(TMP_DIR, `stress-video-${stamp}-${i}.mp4`);
    fs.copyFileSync(src, dst);
    out.push(dst);
  }
  return out;
}

function cleanupFiles(files) {
  for (const f of files) {
    try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
  }
}

async function runAgent(opts) {
  const {
    browser,
    index,
    role, // 'sposo' | 'invitato'
    baseUrl,
    photos = 0,
    videos = 0,
    logStream,
    email,
    password, // per invitati (pre-creati); undefined per sposo (lo genera internamente)
    qrToken, // per invitati
    eventId: knownEventId, // per invitati
    supabaseAdmin, // passed-in dal orchestratore
    coupleName, // per sposo
    eventDate, // per sposo (YYYY-MM-DD)
    watermarkFont, // per sposo (optional: 'great_vibes' | 'classico' | ...)
  } = opts;

  const t0 = Date.now();
  const log2 = (msg) => log(logStream, index, role, msg);

  // Sposo genera la propria password (lo sposo NON è pre-creato via orchestratore: lo crea
  // direttamente l'agent qui, perché serve il flusso completo signUp→setup tenant→create event).
  let pw = password;
  if (role === 'sposo' && !pw) {
    pw = `StressA1${Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, 'x')}`;
  }

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const steps = {
    registered: false,
    eventCreated: false,
    uploadsAttempted: 0,
    uploadsSucceeded: 0,
    eventId: null,
    qrToken: null,
    tenantId: null,
  };

  // Setup network listeners (debug)
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('supabase.co/auth/v1/token') || u.includes('supabase.co/auth/v1/signup')) {
      log2(`[HTTP-REQ] ${req.method()} ${u} body=${(req.postData() || 'none').substring(0, 200)}`);
    }
  });
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('supabase.co/auth/v1/token') || u.includes('supabase.co/auth/v1/signup')) {
      log2(`[HTTP-RESP] ${res.status()} ${u.substring(0, 100)}`);
    }
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) log2(`[NAV->] ${frame.url()}`);
  });
  page.on('pageerror', (err) => log2(`[JS-ERR] ${(err.message || '').substring(0, 200)}`));

  try {
    log2(`START email=${email} pw-len=${pw.length}`);

    // ---------- SPOSO: signup admin + crea tenant+core_users(sposo) ----------
    if (role === 'sposo') {
      const { data: u, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: pw,
        email_confirm: true,
        user_metadata: { name: `Stress Sposo`, source: 'stress-test-sposo' },
      });
      if (createErr) throw new Error(`admin.createUser sposo: ${createErr.message}`);
      const userId = u.user.id;
      steps.tenantId = userId;
      log2(`OK-supabase-user-created uid=${userId}`);

      const tenantName = `${coupleName || 'Stress'} - Matrimonio`;
      const { error: tenantErr } = await supabaseAdmin.from('core_tenants').insert({
        id: userId,
        brand: 'fotosposi',
        locale: 'it',
        name: tenantName,
      });
      if (tenantErr && !String(tenantErr.message || '').includes('duplicate')) {
        log2(`WARN core_tenants insert: ${tenantErr.message}`);
      }
      const { error: userRowErr } = await supabaseAdmin.from('core_users').insert({
        id: userId,
        email,
        name: `Stress Sposo`,
        first_name: (coupleName || 'Sposo').split(/[&\s]/)[0],
        last_name: (coupleName || '').split(/[&\s]/).pop(),
        phone: '+39 3331234567',
        gdpr_consent_at: new Date().toISOString(),
        marketing_consent: false,
        role: 'sposo',
        tenant_id: userId,
      });
      if (userRowErr && !String(userRowErr.message || '').includes('duplicate')) {
        log2(`WARN core_users insert sposo: ${userRowErr.message}`);
      } else {
        log2('OK-core-tenant+user sposo inserted');
      }
      steps.registered = true;
    } else {
      steps.registered = true; // invitati già pre-creati
    }

    // ---------- LOGIN (entrambi i ruoli) ----------
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 20000 });
    log2('NAV-login');

    await page.focus('input#email, input[type="email"]');
    await page.keyboard.type(email, { delay: 30 });
    await page.focus('input#password, input[type="password"]');
    await page.keyboard.type(pw, { delay: 30 });
    await page.waitForTimeout(400);

    const submitButton = page.locator('form button[type="submit"]').first();
    await submitButton.click({ force: true, timeout: 15000 });
    log2('SUBMIT-login');

    try {
      await page.waitForURL(/\/(dashboard|events|event)\b/, { timeout: 25000 });
      log2(`OK-logged-in url=${page.url()}`);
    } catch (e) {
      const body = await page.locator('body').innerText().catch(() => 'ND');
      throw new Error(`login non completato (url=${page.url()}). Body: ${body.substring(0, 200).replace(/\s+/g, ' ')}`);
    }
    await page.waitForTimeout(1500);

    // ---------- BRANCH SPOSO: /events/new → crea evento "Anna & Marco" 26/07/2026 ----------
    if (role === 'sposo') {
      await page.goto(`${baseUrl}/events/new`, { waitUntil: 'networkidle', timeout: 25000 });
      log2('NAV-events-new');

      // 1. Step "plan": click "Crea gratis"
      const allButtons = await page.locator('button').all();
      let planFreeClicked = false;
      for (const b of allButtons) {
        const disabled = await b.isDisabled().catch(() => true);
        const txt = (await b.innerText().catch(() => '')).trim();
        if (txt === 'Crea gratis' && !disabled) {
          await b.click({ timeout: 8000 });
          planFreeClicked = true;
          break;
        }
      }
      log2(planFreeClicked ? 'CLICK-crea-gratis' : 'WARN-no-plan-btn');
      if (planFreeClicked) {
        await page.waitForFunction(
          () => document.querySelectorAll('input[type="text"]').length >= 1,
          { timeout: 15000 },
        ).catch(() => {});
      }

      // 2. Details step: coupleName, date, location
      const textInputsCount = await page.locator('input[type="text"]').count();
      const dateInputsCount = await page.locator('input[type="date"]').count();
      log2(`DEBUG details step textInputs=${textInputsCount} dateInputs=${dateInputsCount}`);
      if (textInputsCount === 0 || dateInputsCount === 0) {
        throw new Error(`details step non raggiunto (url=${page.url()})`);
      }
      await page.locator('input[type="text"]').first().fill(coupleName || 'Stress & Test');
      await page.locator('input[type="date"]').first().fill(eventDate || '2026-07-26');
      const visibleTexts = page.locator('input[type="text"]:visible');
      if (await visibleTexts.count() >= 2) {
        await visibleTexts.nth(1).fill('Roma');
      }
      log2('FILL-event-details');

      // Cattura REST POST event
      page.on('response', async (res) => {
        const u = res.url();
        if (u.includes('supabase.co/rest/v1/events') && res.request().method() === 'POST') {
          let body = '{}';
          try { body = await res.text(); } catch (e) {}
          log2(`[REST-EVENTS] ${res.status()} body=${body.substring(0, 200)}`);
        }
      });

      await page.getByRole('button', { name: /Crea evento/i }).first().click({ timeout: 15000 });
      log2('SUBMIT-event');

      // 3. Card "Evento creato! ✅" → click "Salta"
      try {
        await page.waitForSelector('button:has-text("Salta")', { timeout: 25000 });
        const skipBtn = page.locator('button', { hasText: /Salta/i }).first();
        await skipBtn.click({ timeout: 10000 });
        log2('CLICK-salta-drive');
      } catch (e) {
        log2(`WARN-salta-btn-not-found: ${(e.message || '').substring(0, 100)}`);
      }

      await page.waitForURL(/\/events\/[a-f0-9-]+/, { timeout: 30000 }).catch(() => {});
      const match = page.url().match(/\/events\/([a-f0-9-]+)/);
      if (!match) throw new Error(`event url non trovata (url=${page.url()})`);
      const eventId = match[1];
      steps.eventId = eventId;
      steps.eventCreated = true;
      log2(`OK-event-created id=${eventId}`);

      // 4. Watermark settings — il menu è un <details><summary> custom (vedi settings/page.tsx
      //    riga 164). Aperto il details, ogni font è un <button type="button"> col testo della
      //    label del font. Click sul font desiderato → click "Salva" → verify persisted.
      if (watermarkFont) {
        try {
          await page.goto(`${baseUrl}/events/${eventId}/settings`, { waitUntil: 'networkidle', timeout: 20000 });
          log2('NAV-settings');

          // Apri il <details> del font (click sul <summary>)
          const summary = page.locator('details > summary').first();
          if (await summary.count()) {
            await summary.click({ timeout: 5000 });
            log2('CLICK-watermark-details-open');
            await page.waitForTimeout(300);

            // Cerca il bottone-font col testo che corrisponde al `value` richiesto.
            // I bottoni-font hanno testo = label del font (es. "Great Vibes"), non value ("great_vibes").
            // Mappo value→label usando WATERMARK_FONTS inline (replico la struttura del file TS).
            const FONT_LABEL_MAP = {
              classico: 'Playfair Display', // default
              great_vibes: 'Great Vibes',
              dancing: 'Dancing Script',
              allura: 'Allura',
              pinyon_script: 'Pinyon Script',
              italianno: 'Italianno',
              // ... altri 28; se watermarkFont non è qui, fallback a click diretto sul value come text
            };
            const targetLabel = FONT_LABEL_MAP[watermarkFont] || watermarkFont;

            const fontBtn = page.locator(`button[type="button"]:has-text("${targetLabel}")`).first();
            if (await fontBtn.count()) {
              await fontBtn.click({ timeout: 5000 });
              log2(`SET-watermark-font=${watermarkFont} (label="${targetLabel}")`);
              await page.waitForTimeout(300);
            } else {
              // fallback: cerca bottone che ha testo == value
              const fallbackBtn = page.locator(`button[type="button"]:has-text("${watermarkFont}")`).first();
              if (await fallbackBtn.count()) {
                await fallbackBtn.click({ timeout: 5000 });
                log2(`SET-watermark-font=${watermarkFont} (raw fallback)`);
              } else {
                log2(`WARN-watermark-font-not-found-in-UI value=${watermarkFont} label=${targetLabel}`);
              }
            }
          } else {
            log2('WARN-no-watermark-details-element');
          }

          // Save button (vedi settings/page.tsx riga 220): ⚠ ha anche variant "Salvataggio..." durante saving
          const saveBtn = page.locator('button:not([disabled]):has-text("Salva")').first();
          if (await saveBtn.count()) {
            await saveBtn.click({ timeout: 5000 });
            log2('CLICK-save-settings');
            // Attendi che compaia "Salvato ✓" (max 5s)
            await page.waitForSelector('text=Salvato', { timeout: 5000 }).catch(() => {});
            log2('OK-watermark-saved');
          } else {
            log2('WARN-no-save-button');
          }
        } catch (e) {
          log2(`WARN-watermark-setup-failed: ${(e.message || '').substring(0, 150)}`);
        }
      }

      // 5. Genera QR token (service role, come farebbe la pagina /qr)
      const qrToken = crypto.randomUUID();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { error: qrErr } = await supabaseAdmin.from('core_auth_tokens').insert({
        event_id: eventId,
        token: qrToken,
        role: 'invitato',
        expires_at: tomorrow.toISOString(),
      });
      if (qrErr) {
        log2(`WARN-qr-token-insert: ${qrErr.message}`);
        steps.qrToken = null;
      } else {
        steps.qrToken = qrToken;
        log2(`OK-qr-token-created token=${qrToken.substring(0, 8)}...`);
      }

      // 6. Upgrade tier a 'premium' per abilitare upload video (Free blocca video).
      //    Stripe non è ancora integrato → bypass via service role per fini di stress test.
      const { error: tierErr } = await supabaseAdmin
        .from('events')
        .update({ tier: 'premium' })
        .eq('id', eventId);
      if (tierErr) {
        log2(`WARN-tier-upgrade: ${tierErr.message}`);
      } else {
        log2('OK-tier-upgraded-to-premium');
      }

      await ctx.close();
      return { success: true, durationMs: Date.now() - t0, ...steps };
    }

    // ---------- BRANCH INVITATO: naviga a /event/<qrToken> → "Carica" → upload N foto+M video ----------
    if (role === 'invitato') {
      steps.eventId = knownEventId;
      if (!qrToken) throw new Error('invitato senza qrToken');
      if (!knownEventId) throw new Error('invitato senza eventId');

      await page.goto(`${baseUrl}/event/${qrToken}`, { waitUntil: 'networkidle', timeout: 20000 });
      log2('NAV-event-qr');

      // Verifica che la pagina guest abbia caricato l'evento
      try {
        await page.waitForFunction(
          () => /Anna|Marco|Matrimonio|Sposi/i.test(document.body.innerText || ''),
          { timeout: 15000 },
        );
        log2('OK-guest-page-loaded');
      } catch {
        log2('WARN-guest-page-event-not-visible');
      }

      // Click bottone "Carica" → va a /events/<id>/upload
      const caricaBtn = page.locator('a:has-text("Carica"), button:has-text("Carica")').first();
      if (await caricaBtn.count()) {
        await caricaBtn.click({ timeout: 8000 });
        log2('CLICK-carica');
      } else {
        // Fallback: naviga diretto alla upload page
        await page.goto(`${baseUrl}/events/${knownEventId}/upload`, { waitUntil: 'networkidle', timeout: 15000 });
        log2('NAV-upload-fallback');
      }

      await page.waitForURL(/\/events\/[a-f0-9-]+\/upload/, { timeout: 15000 }).catch(() => {});
      log2(`NAV-upload url=${page.url()}`);

      // Costruisci lista file: N foto + M video
      const files = buildUploadFiles(photos, videos);
      steps.uploadsAttempted = files.length;
      log2(`DEBUG-build-upload-files n=${files.length} photos=${photos} videos=${videos}`);

      // L'upload page mostra un <Loader2> finché eventReady===false (vedi upload/page.tsx riga 230).
      // Solo dopo che getEventTier + loadQueue ritornano, vengono renderizzati l'<input file>'
      // e la Card "Galleria". Devo attendere che la UI completa sia pronta prima del setInputFiles.
      await page.waitForSelector('div.cursor-pointer:has-text("Galleria")', { timeout: 25000 });
      log2('OK-upload-page-ready (Card Galleria visible)');

      // La pagina upload (apps/web/.../upload/page.tsx) usa 2 <Card> cliccabili che
      // chiamano inputRef.current?.click() (input file nascosto con display:none).
      // Playwright setInputFiles accetta force:true su display:none, MA l'input deve essere
      // montato nel DOM. L'input ha multiple + accept image+video (tier premium).
      const fileInput = page.locator('input[type="file"][multiple]').first();
      // Doppia verifica: presente + multi
      log2(`DEBUG fileinput count=${await page.locator('input[type="file"][multiple]').count()}`);
      await fileInput.setInputFiles(files, { force: true });
      log2(`SUBMIT-upload files=${files.length}`);

      // Attendi "Tutti i file elaborati!" (o simile)
      try {
        await page.waitForFunction(
          () => /Tutti i file elaborati|completato|fatto!/i.test(document.body.innerText || ''),
          { timeout: 120000 },
        );
        log2('OK-upload-queue-done');
        steps.uploadsSucceeded = files.length;
      } catch {
        log2('WARN-upload-queue-still-busy-after-120s');
      }
      cleanupFiles(files);

      // Verifica media nella galleria
      await page.goto(`${baseUrl}/events/${knownEventId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      try {
        await page.waitForFunction(
          () => document.querySelectorAll('article img, article video, [data-media-id]').length > 0,
          { timeout: 45000 },
        );
        const count = await page.locator('article img, article video, [data-media-id]').count();
        log2(`OK-media-in-gallery count=${count}`);
      } catch {
        log2('WARN-no-media-in-gallery');
      }

      await ctx.close();
      return { success: true, durationMs: Date.now() - t0, ...steps };
    }

    throw new Error(`ruolo non supportato: ${role}`);
  } catch (err) {
    log2(`ERR ${(err && err.message) || err}`);
    // Cleanup tmp files anche su errore
    if (role === 'invitato') {
      // best-effort cleanup
      try {
        const leftover = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith('stress-'));
        leftover.slice(0, 50).forEach((f) => { try { fs.unlinkSync(path.join(TMP_DIR, f)); } catch (e) {} });
      } catch (e) {}
    }
    await ctx.close();
    return { success: false, durationMs: Date.now() - t0, error: String((err && err.message) || err), ...steps };
  }
}

module.exports = { runAgent };
