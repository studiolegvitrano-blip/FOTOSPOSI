// scripts/cleanup-stress-test.mjs
// Cancella tutti gli eventi stress test (couple_name like 'Stress%' o 'Anna &%' o 'Test%'),
// i media associati, le code, gli invitati.
// Da eseguire con cautela: ha accesso totali via service role.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://krgqyluuiltckmhbeuue.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY non trovata');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  console.log('--- Pulizia stress test eventi ---');

  // 1) Identifica eventi stress test (created_by = user stress-* + couple_name not user-provided come wedding reali)
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, couple_name, created_by, created_at, tenant_id, r2_folder_name, media_count:media_uploads(count)')
    .ilike('couple_name', '%stress%')
    .order('created_at', { ascending: false });
  if (evErr) throw evErr;
  console.log(`Trovati ${events.length} eventi con couple_name like '%stress%':`);
  for (const e of events) console.log(`  - ${e.id}  "${e.couple_name}"  by=${e.created_by.substring(0, 8)}  media=${e.media_count?.[0]?.count ?? 0}  ${e.created_at}`);

  // 2) Anche eventi dei test Anna & Marco recenti (dopo 25/07/2026)
  const { data: annaEventi, error: annaErr } = await supabase
    .from('events')
    .select('id, couple_name, created_by, created_at, tenant_id, r2_folder_name, media_count:media_uploads(count)')
    .ilike('couple_name', '%Anna%Marco%')
    .gte('created_at', '2026-07-20T00:00:00')
    .order('created_at', { ascending: false });
  if (annaErr) throw annaErr;
  console.log(`\nTrovati ${annaEventi.length} eventi "Anna & Marco" dal 20/07 in poi:`);
  for (const e of annaEventi) console.log(`  - ${e.id}  "${e.couple_name}"  media=${e.media_count?.[0]?.count ?? 0}  ${e.created_at}`);

  const allTargets = [...events, ...annaEventi];
  const dedup = [...new Map(allTargets.map((e) => [e.id, e])).values()];
  console.log(`\nTotale unici da cancellare: ${dedup.length}`);

  if (process.argv.includes('--dry-run')) {
    console.log('Dry run — nessuna cancellazione. Riprovare con --apply');
    return;
  }
  if (!process.argv.includes('--apply')) {
    console.log('Specifica --apply per cancellare.');
    return;
  }

  // 3) Cancella tutto per ogni evento
  for (const e of dedup) {
    console.log(`\nCancello evento ${e.id} "${e.couple_name}"...`);
    const { error: e1 } = await supabase.from('media_uploads').delete().eq('event_id', e.id);
    if (e1) console.error('  media_uploads:', e1.message);
    else console.log('  ✓ media_uploads');

    const { error: e2 } = await supabase.from('upload_queue').delete().eq('event_id', e.id);
    if (e2) console.error('  upload_queue:', e2.message);
    else console.log('  ✓ upload_queue');

    const { error: e3 } = await supabase.from('event_guests').delete().eq('event_id', e.id);
    if (e3 && !String(e3.message || '').includes('does not exist')) console.error('  event_guests:', e3.message);
    else console.log('  ✓ event_guests');

    const { error: e4 } = await supabase.from('core_auth_tokens').delete().eq('event_id', e.id);
    if (e4) console.error('  core_auth_tokens:', e4.message);
    else console.log('  ✓ core_auth_tokens');

    const { error: e5 } = await supabase.from('sub_events').delete().eq('event_id', e.id);
    if (e5 && !String(e5.message || '').includes('does not exist')) console.error('  sub_events:', e5.message);
    else console.log('  ✓ sub_events');

    const { error: e6 } = await supabase.from('event_windows').delete().eq('event_id', e.id);
    if (e6) console.error('  event_windows:', e6.message);
    else console.log('  ✓ event_windows');

    const { error: e7 } = await supabase.from('event_drafts').delete().eq('event_id', e.id);
    if (e7 && !String(e7.message || '').includes('does not exist')) console.error('  event_drafts:', e7.message);
    else console.log('  ✓ event_drafts');

    const { error: e8 } = await supabase.from('events').delete().eq('id', e.id);
    if (e8) console.error('  events:', e8.message);
    else console.log('  ✓ events');
  }

  // 4) Cancella core_auth_tokens orfani (event_id in tokens non esiste più)
  const { error: t2 } = await supabase
    .from('core_auth_tokens')
    .delete()
    .is('event_id', null);
  if (t2 && !String(t2.message).includes('does not exist')) console.error('  tokens null:', t2.message);

  console.log('\n--- FATTO ---');
}

main().catch((e) => { console.error(e); process.exit(1); });
