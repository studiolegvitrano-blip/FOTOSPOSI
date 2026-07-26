// probe-events-new.js
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
  await admin.auth.admin.createUser({ email, password: 'StressA1abc123def', email_confirm: true });
  console.log('user:', email);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.focus('input#email'); await page.keyboard.type(email, { delay: 30 });
  await page.focus('input#password'); await page.keyboard.type('StressA1abc123def', { delay: 30 });
  await page.waitForTimeout(500);
  await page.locator('form button[type="submit"]').click({ force: true });
  await page.waitForURL(/\/dashboard/, { timeout: 25000 });
  console.log('login OK:', page.url());

  await page.goto('http://localhost:3000/events/new', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);
  const buttons = await page.locator('button').all();
  console.log('Buttons visualizzati su /events/new:');
  for (const b of buttons) {
    const text = (await b.innerText()).trim();
    const disabled = await b.isDisabled();
    if (text) console.log(` - "[${text}]" disabled=${disabled}`);
  }
  const textInputs = await page.locator('input[type="text"]').count();
  const dateInputs = await page.locator('input[type="date"]').count();
  console.log('text inputs:', textInputs, 'date inputs:', dateInputs);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
