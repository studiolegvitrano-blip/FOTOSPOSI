// probe-upload.js — diagnostica cosa sta nella /upload page dopo click "Carica" su guest page
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const { chromium } = require('playwright');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const BASE = process.env.STRESS_BASE_URL || 'http://localhost:3000';
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const email = `probe-upload+${crypto.randomUUID()}@example.test`;
  const password = 'ProbeUploadA1xxx';

  console.log('Create user+invitato');
  const { data: u } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  const uid = u.user.id;

  console.log('Find latest event');
  const { data: ev } = await supabaseAdmin
    .from('events')
    .select('id, couple_name, tier, tenant_id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log('Latest event:', ev);

  if (!ev) { console.log('NO EVENTS IN DB'); process.exit(1); }

  await supabaseAdmin.from('core_users').insert({
    id: uid, email, name: 'Probe', role: 'invitato',
    tenant_id: ev.tenant_id, event_id: ev.id,
    gdpr_consent_at: new Date().toISOString(),
  });

  // Crea QR token
  const token = crypto.randomUUID();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  await supabaseAdmin.from('core_auth_tokens').insert({
    event_id: ev.id, token, role: 'invitato',
    expires_at: tomorrow.toISOString(),
  });

  console.log('Login browser');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text().substring(0, 200)));
  page.on('pageerror', (e) => console.log(`[pageerror]`, e.message.substring(0, 200)));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.focus('input[type="email"]');
  await page.keyboard.type(email, { delay: 30 });
  await page.focus('input[type="password"]');
  await page.keyboard.type(password, { delay: 30 });
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/dashboard/, { timeout: 15000 });

  console.log('Navigate /event/' + token);
  await page.goto(`${BASE}/event/${token}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click "Carica"
  const caricaBtn = page.locator('a:has-text("Carica"), button:has-text("Carica")').first();
  await caricaBtn.click();
  await page.waitForURL(/\/events\/[a-f0-9-]+\/upload/, { timeout: 10000 });

  console.log('On upload page. Waiting 5s for hydration...');
  await page.waitForTimeout(5000);

  // Dump del contenuto
  const body = await page.locator('body').innerText();
  console.log('--- BODY innerText (first 1000 chars) ---');
  console.log(body.substring(0, 1000));
  console.log('--- end body ---');

  // Cerca elementi specifici
  const cardGalleriaCount = await page.locator('div.cursor-pointer:has-text("Galleria")').count();
  console.log('Card Galleria count =', cardGalleriaCount);

  const fileInputsCount = await page.locator('input[type="file"]').count();
  console.log('input[type=file] count =', fileInputsCount);

  const loaderCount = await page.locator('.animate-spin').count();
  console.log('spinner count =', loaderCount);

  // Salva screenshot
  await page.screenshot({ path: path.join(__dirname, 'probe-upload.png'), fullPage: true });
  console.log('Screenshot saved: probe-upload.png');

  // Cleanup
  await supabaseAdmin.from('core_auth_tokens').delete().eq('token', token);
  await supabaseAdmin.from('core_users').delete().eq('id', uid);
  await supabaseAdmin.auth.admin.deleteUser(uid);

  await browser.close();
})().catch((e) => { console.error('PROBE ERR:', e); process.exit(1); });
