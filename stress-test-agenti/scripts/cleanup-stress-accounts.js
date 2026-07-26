// scripts/cleanup-stress-accounts.js
// Cancella tutti gli utenti Supabase Auth con email "stress+*@example.test" creati durante gli stress test.
// Richiede SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Mancano SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY nelle env.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function main() {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) { console.error('listUsers error:', error.message); process.exit(1); }
  const stressUsers = (data.users || []).filter((u) => /^stress\+.*@example\.test$/.test(u.email || ''));
  console.log(`Trovati ${stressUsers.length} account stress.`);
  let ok = 0, ko = 0;
  for (const u of stressUsers) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) { console.error(`delete ${u.email}: ${error.message}`); ko++; }
    else { ok++; }
  }
  // Pulisci anche core_users
  const { error: coreErr } = await supabase.from('core_users').delete().like('email', 'stress+%@example.test');
  if (coreErr) console.warn('cleanup core_users warning:', coreErr.message);
  console.log(`OK ${ok}, KO ${ko}`);
}
main();
