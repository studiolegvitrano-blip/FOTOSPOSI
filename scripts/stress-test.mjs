import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Mancano SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const BATCH_SIZE = 100;
const MAX_BATCHES = 50;

const LOCATIONS = ['Roma,IT', 'Milano,IT', 'Napoli,IT', 'Firenze,IT', 'Venezia,IT', 'London,UK', 'New York,US', 'Barcelona,ES', 'Paris,FR', 'Berlin,DE'];
const FEATURE_KEYS = ['photo_vote', 'wall', 'drive_backup', 'quiz', 'photo_hunt', 'dress_vote', 'video_guestbook', 'photo_overlay', 'wedding_wrapped', 'kiosk', 'wow_walk', 'video_challenges', 'ai_concierge', 'reel_riassunto'];

function randomDate() {
  const s = new Date('2026-05-01'), e = new Date('2026-10-31');
  return new Date(s.getTime() + Math.random() * (e.getTime() - s.getTime())).toISOString().split('T')[0];
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const fmt = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

async function getDB() {
  try {
    const { data } = await supabase.rpc('pg_database_size');
    if (data) return data;
  } catch {}
  return null;
}

async function getTableSizes() {
  try {
    const { data } = await supabase.rpc('get_table_sizes');
    return data;
  } catch {}
  return null;
}

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  STRESS TEST — Supabase Free Tier');
  console.log('  Architettura: Supabase buffer → Drive storage definitivo');
  console.log('  Limite DB:    500 MB (Storage 1GB è solo buffer temporaneo)');
  console.log('═══════════════════════════════════════════════════════\n');

  const { data: tenants } = await supabase.from('core_tenants').select('id').limit(1);
  if (!tenants?.length) { console.error('Nessun tenant.'); process.exit(1); }
  const { data: users } = await supabase.from('core_users').select('id').limit(1);
  if (!users?.length) { console.error('Nessun utente.'); process.exit(1); }

  const tenantId = tenants[0].id, userId = users[0].id;
  let total = 0, start = Date.now();
  const DB_LIMIT = 500 * 1024 * 1024;

  for (let b = 1; b <= MAX_BATCHES; b++) {
    process.stdout.write(`\r  Batch ${b}/${MAX_BATCHES} | ${total} eventi creati`);

    const events = Array.from({ length: BATCH_SIZE }, (_, i) => ({
      tenant_id: tenantId, created_by: userId,
      couple_name: `Test ${b}-${i}`, date: randomDate(),
      location: pick(LOCATIONS), brand: 'fotosposi', tier: 'free',
    }));

    const { data: created, error } = await supabase.from('events').insert(events).select('id, date, location');
    if (error) { console.log(`\n  ✗ Errore batch ${b}: ${error.message}`); break; }

    const winRows = [], featRows = [];
    for (const ev of created) {
      const d = new Date(ev.date);
      const opens = new Date(d); opens.setDate(opens.getDate() - 18);
      const closes = new Date(d); closes.setDate(closes.getDate() + 2);
      winRows.push({ event_id: ev.id, opens_at: opens.toISOString(), closes_at: closes.toISOString() });
      featRows.push({ event_id: ev.id, feature_key: pick(FEATURE_KEYS), enabled: true });
    }
    await supabase.from('event_windows').insert(winRows);
    await supabase.from('event_features').insert(featRows);

    total += created.length;

    if (b % 5 === 0) {
      const db = await getDB();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (db) {
        const pct = db / DB_LIMIT * 100;
        const est = Math.floor(total / (pct / 100));
        console.log(`\n  📊 DB: ${fmt(db)} (${pct.toFixed(1)}%) | Eventi: ${total} | Max stimato: ~${est} eventi`);
        const tables = await getTableSizes();
        if (tables) {
          console.log('  📋 Top 5 tabelle:');
          tables.slice(0, 5).forEach((t) => console.log(`    ${t.table_name}: ${t.human_size}`));
        }
        if (db > DB_LIMIT * 0.85) {
          console.log(`\n  ⚠️  85% del limite DB raggiunto! Arresto.`); break;
        }
      } else {
        console.log(`\n  📊 Eventi: ${total} | Tempo: ${elapsed}s (DB size non disponibile)`);
      }
    }
  }

  const mins = ((Date.now() - start) / 60000).toFixed(1);
  const { count } = await supabase.from('events').select('*', { count: 'exact', head: true });
  const dbFinal = await getDB();

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  RISULTATI`);
  console.log(`═══════════════════════════════════════════════════════`);
  console.log(`  Eventi creati:     ${count || total}`);
  console.log(`  Tempo:             ${mins} min`);
  console.log(`  Velocità:          ${Math.round((count || total) / Math.max(1, parseFloat(mins)))} eventi/min`);

  if (dbFinal) {
    const pct = dbFinal / DB_LIMIT * 100;
    const estMax = Math.floor((count || total) / (pct / 100));
    console.log(`  DB finale:         ${fmt(dbFinal)} (${pct.toFixed(1)}%)`);
    console.log(`  STIMA MAX EVENTI:  ~${estMax} eventi in 500 MB`);
    console.log(`  (con codice evento, finestra, 1 feature, nessuna foto in DB)`);
    console.log(`\n  📌 Scenario reale (con foto 500 KB buffer→Drive poi cancella):`);
    console.log(`     Storage non è limite (buffer temporaneo)`);
    console.log(`     Database è l'unico vincolo → ~${estMax} eventi`);
    console.log(`     Con 5 utenti/evento → ${(estMax * 5 / 50000).toFixed(0)}% del limite Auth (50k utenti)`);
  }
  console.log(`\n  PULIZIA: DELETE FROM events WHERE couple_name LIKE 'Test %';`);
  console.log(`═══════════════════════════════════════════════════════`);
}

run().catch(console.error);
