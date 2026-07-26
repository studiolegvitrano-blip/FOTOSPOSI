// stress-test-agenti/agent.js
// Singolo agente: naviga, registra, crea evento, carica foto+video in parallelo

const path = require('path');
const fs = require('fs');

const FIXTURES = path.join(__dirname, 'fixtures');

function listFixtures(ext) {
  return fs.readdirSync(FIXTURES)
    .filter((f) => f.toLowerCase().endsWith(ext.toLowerCase()))
    .map((f) => path.join(FIXTURES, f));
}

function log(stream, agentIdx, msg) {
  const line = `[${new Date().toISOString()}] agent=${agentIdx} ${msg}\n`;
  stream.write(line);
  process.stdout.write(line);
}

async function runAgent({ browser, index, baseUrl, photos, videos, logStream, email }) {
  const t0 = Date.now();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const steps = { registered: false, eventCreated: false, uploadsAttempted: 0, uploadsSucceeded: 0 };

  try {
    log(logStream, index, `START email=${email}`);

    // 1. Naviga home
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    log(logStream, index, 'NAV-home');

    // 2. Click Registrati
    await page.getByRole('link', { name: /Registrati|Sign up|Start/i }).first().click({ timeout: 8000 });
    await page.waitForURL(/\/(signup|register)/, { timeout: 8000 });
    log(logStream, index, 'NAV-signup');

    // 3. Compila form
    const password = `Stress!${Math.random().toString(36).slice(2, 10)}`;
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    if (await page.locator('input[name="firstName"]').count()) await page.fill('input[name="firstName"]', 'Stress');
    if (await page.locator('input[name="lastName"]').count()) await page.fill('input[name="lastName"]', `Agent${index}`);
    if (await page.locator('input[name="phone"]').count()) await page.fill('input[name="phone"]', '+390000000000');

    const gdpr = page.locator('input[name="gdpr"], input[type="checkbox"][required]').first();
    if (await gdpr.count()) await gdpr.check();

    await page.getByRole('button', { name: /Registrati|Sign up|Submit|Continue/i }).first().click({ timeout: 10000 });
    log(logStream, index, 'SUBMIT-signup');

    // 4. Skip conferma email: PROFILO dell'agente viene confermato lato server da scripts/cleanup-stress-accounts.js
    await page.waitForTimeout(1500);
    steps.registered = true;
    log(logStream, index, 'OK-signedup');

    // 5. Naviga a dashboard → crea evento Free
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.goto(`${baseUrl}/events/new`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    log(logStream, index, 'NAV-events-new');

    // Click bottone Free + submit evento minimo
    const freeBtn = page.getByRole('button', { name: /Free|0€|Crea gratis|Start free/i }).first();
    if (await freeBtn.count()) await freeBtn.click({ timeout: 5000 }).catch(() => {});

    await page.fill('input[name="coupleName"]', `Agent${index}'s Wedding`).catch(() => {});
    await page.fill('input[name="date"]', '2026-12-31').catch(() => {});
    await page.getByRole('button', { name: /Crea evento|Create event|Submit/i }).first().click({ timeout: 15000 }).catch(() => {});

    // 6. Attendi redirect a /events/<id>
    await page.waitForURL(/\/events\/[a-f0-9-]+/, { timeout: 25000 }).catch(() => {});
    const match = page.url().match(/\/events\/([a-f0-9-]+)/);
    if (!match) throw new Error('event url non trovata');
    const eventId = match[1];
    steps.eventCreated = true;
    log(logStream, index, `OK-event-created id=${eventId}`);

    // 7. Naviga a pagina upload
    await page.goto(`${baseUrl}/events/${eventId}/upload`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    log(logStream, index, 'NAV-upload');

    // 8. Carica N foto + M video in un unico input (se multi-file)
    const photoFiles = listFixtures('.jpg').slice(0, photos);
    const videoFiles = listFixtures('.mp4').slice(0, videos);
    const allFiles = [...photoFiles, ...videoFiles];
    steps.uploadsAttempted = allFiles.length;

    if (allFiles.length === 0) {
      log(logStream, index, 'WARN-no-fixture-skip');
      return { success: true, durationMs: Date.now() - t0, ...steps };
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(allFiles);
    log(logStream, index, `SUBMIT-upload files=${allFiles.length}`);

    // 9. Attendi che i media compaiano in galleria (timeout 60s per R2 process)
    await page.waitForFunction(
      () => document.querySelectorAll('img[src*="/demo/"], img[src*="r2"], [data-media-id]').length > 0,
      { timeout: 60000 }
    ).catch(() => {});
    steps.uploadsSucceeded = allFiles.length;
    log(logStream, index, `OK-upload-done success=${steps.uploadsSucceeded}`);

    await ctx.close();
    return { success: true, durationMs: Date.now() - t0, ...steps };
  } catch (err) {
    log(logStream, index, `ERR ${(err && err.message) || err}`);
    await ctx.close();
    return { success: false, durationMs: Date.now() - t0, error: String(err && err.message || err), ...steps };
  }
}

module.exports = { runAgent };
