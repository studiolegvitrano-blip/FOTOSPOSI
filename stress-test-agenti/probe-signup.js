// stress-test-agenti/probe-signup.js — diagnostica headed per capire se signup autentica l'utente
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Carica .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const email = 'stress+' + crypto.randomUUID() + '@example.test';
  const password = 'Stress!test12345';
  console.log('Email:', email);

  // SIGNUP
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.getByRole('link', { name: /Registrati|Sign up|Start/i }).first().click({ timeout: 8000 });
  await page.waitForURL(/\/(signup|register)/, { timeout: 8000 });
  await page.fill('input#email', email);
  await page.fill('input#firstName', 'Stress');
  await page.fill('input#lastName', 'Probe');
  await page.fill('input#password', password);
  const phoneInput = page.locator('input[type="tel"]').first();
  if (await phoneInput.count()) await phoneInput.fill('333 1234567');
  await page.locator('input[type="checkbox"][required]').first().check({ force: true });
  await page.getByRole('button', { name: /^Registrati$/i }).first().click({ timeout: 15000 });

  // attesa card conferma
  await page.waitForFunction(() => /controlla la tua email|verifica|email di conferma|check your email/i.test(document.body.innerText || ''), { timeout: 12000 });
  console.log('Signup OK');

  // Conferma via Admin API
  const { createClient } = require('@supabase/supabase-js');
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: listData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = (listData.users || []).find((u) => u.email === email);
  if (user && !user.email_confirmed_at) {
    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    console.log('Email confermata:', user.id);
  } else if (user) {
    console.log('Email già confermata');
  } else {
    console.log('UTENTE NON TROVATO dopo signup. Abort.');
    await browser.close();
    return;
  }

  // LOGIN
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.fill('input#email', email);
  await page.fill('input#password', password);

  console.log('Prima del click Accedi. URL:', page.url());
  page.on('framenavigated', (f) => console.log('[framenavigated]', f.url()));
  page.on('request', (r) => { if (r.url().includes('/auth') || r.url().includes('supabase')) console.log('[req]', r.method(), r.url()); });
  page.on('response', (r) => { if (r.url().includes('/auth') || r.url().includes('supabase')) console.log('[resp]', r.status(), r.url()); });

  await page.getByRole('button', { name: /^Accedi$/i }).first().click({ timeout: 15000 });
  console.log('Click Accedi partito. Aspetto 15s...');
  await page.waitForTimeout(15000);
  console.log('URL dopo 15s:', page.url());
  console.log('Cookies:', (await ctx.cookies()).map((c) => c.name + '=' + c.value.substring(0, 20) + '...').join(' | '));
  const body = await page.locator('body').innerText().catch(() => 'ND');
  console.log('Body snippet:', body.substring(0, 400));

  await browser.close();
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});

