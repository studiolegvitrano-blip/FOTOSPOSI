// stress-test-agenti/probe-login.js — diagnostica login con service-role user creato direttamente
const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

(async () => {
  const { createClient } = require('@supabase/supabase-js');
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = 'stress+' + crypto.randomUUID() + '@example.test';
  const password = 'StressA1xx123456';
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  console.log('user:', email);
  console.log('pw:', password);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (msg) => console.log('[con]', msg.type(), msg.text().substring(0, 250)));
  page.on('pageerror', (err) => console.log('[pagerr]', err.message));
  page.on('request', (req) => { if (req.url().includes('supabase.co/auth') || req.url().includes('/auth/')) console.log('[req]', req.method(), req.url()); });
  page.on('response', (res) => { if (res.url().includes('supabase.co/auth') || res.url().includes('/auth/')) console.log('[resp]', res.status(), res.url()); });

  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input#email', email);
  await page.fill('input#password', password);
  await page.waitForTimeout(800);

  // Provo click diretto sul button[type=submit]
  const submitBtn = page.locator('button[type="submit"]').first();
  console.log('submitBtn count:', await submitBtn.count());

  // Provo submit via JS diretto del form
  const formCount = await page.locator('form').count();
  console.log('form count:', formCount);

  await submitBtn.click({ force: true });
  console.log('click eseguito, aspetto 15s');
  await page.waitForTimeout(15000);
  console.log('URL finale:', page.url());
  const body = await page.locator('body').innerText().catch(() => 'ND');
  console.log('Body:', body.substring(0, 300));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
