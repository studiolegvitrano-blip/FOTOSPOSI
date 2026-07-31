import { NextRequest, NextResponse } from 'next/server';

/**
 * GET-ish POST handler (POST perché GET con body è possibile ma REST-fully sconsigliato):
 * verifica se una riga `core_users` esiste già per un dato `userId` (ID Supabase Auth).
 * Usato dal form di onboarding post-OAuth in /auth/callback per decidere se mostrare il
 * form (primo login: nessuna riga) o saltare direttamente al redirect (login successivo:
 * riga già presente dall'onboarding precedente).
 *
 * Il servizio usa la service role per bypassare RLS (la RLS su core_users limita
 * `auth.uid() = id`, ma qui stiamo rispondendo a una richiesta che riguarda l'utente
 * stesso, autenticato via JWT — quindi è legittimo leggere la sua riga).
 */
export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'userId mancante' }, { status: 400 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from('core_users')
    .select('id, role_at_event, first_name, last_name, phone')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    exists: !!data,
    user: data ?? null,
  });
}
