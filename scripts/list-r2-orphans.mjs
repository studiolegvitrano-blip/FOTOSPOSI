#!/usr/bin/env node
// scripts/list-r2-orphans.mjs
// FIX 29/07/2026 — Script CLI per identificare file orfani su R2.
// Identico alla route /api/r2/orphans ma eseguibile in locale senza deployare.
// Usa solo le env vars standard di Vercel (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
// R2_SECRET_ACCESS_KEY, R2_BUCKET) e SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// per interrogare il DB.
//
// Uso:
//   node scripts/list-r2-orphans.mjs
//   node scripts/list-r2-orphans.mjs --prefix events/
//   node scripts/list-r2-orphans.mjs --sample
//
// Output: JSON su stdout con la stessa shape della route /api/r2/orphans.

import { S3Client, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Carica .env.local di apps/web se presente
try {
  const envPath = join(process.cwd(), 'apps', 'web', '.env.local');
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // .env.local non esiste: usa le env già esportate nella shell
}

const args = process.argv.slice(2);
const prefix = (args.find((a) => a.startsWith('--prefix='))?.split('=')[1]) ?? '';
const sample = args.includes('--sample');

for (const envName of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!process.env[envName]) {
    console.error(`Manca env ${envName}. Esporta le credenziali o crea apps/web/.env.local`);
    process.exit(1);
  }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function listAllKeys(prefix) {
  const keys = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const o of res.Contents ?? []) if (o.Key) keys.push(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

async function loadDbKeys() {
  const allR2 = new Set();
  const allOrig = new Set();
  const allQ = new Set();
  let from = 0;
  while (true) {
    const { data } = await supabase.from('media_uploads').select('r2_key, original_r2_key').not('r2_key', 'is', null).range(from, from + 999);
    for (const r of data ?? []) {
      if (r.r2_key) allR2.add(r.r2_key);
      if (r.original_r2_key) allOrig.add(r.original_r2_key);
    }
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  from = 0;
  while (true) {
    const { data } = await supabase.from('upload_queue').select('r2_key').not('r2_key', 'is', null).range(from, from + 999);
    for (const r of data ?? []) if (r.r2_key) allQ.add(r.r2_key);
    if (!data || data.length < 1000) break;
    from += 1000;
  }
  return { allR2, allOrig, allQ };
}

const r2Keys = await listAllKeys(prefix);
const { allR2, allOrig, allQ } = await loadDbKeys();
const orphans = r2Keys.filter((k) => !allR2.has(k) && !allOrig.has(k) && !allQ.has(k));

const result = {
  prefix,
  r2Total: r2Keys.length,
  dbTotal: allR2.size + allOrig.size,
  totalOrphans: orphans.length,
  sample,
  orphans: sample ? orphans.slice(0, 100) : orphans.slice(0, 100),
  hint: orphans.length > 100 && !sample ? 'Lista troncata a 100. Per audit completo, usa Supabase Studio o contatta l\'amministratore.' : undefined,
};

console.log(JSON.stringify(result, null, 2));
