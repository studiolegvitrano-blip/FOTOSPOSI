/**
 * Risolve la sessione OAuth al ritorno da un provider (Google/Facebook) su /auth/callback.
 *
 * BUG FIXATO 07/08/2026: createBrowserClient (@supabase/ssr, v0.6.1) ha detectSessionInUrl:
 * true di default → all'init della pagina scambia il code AUTOMATICAMENTE (POST /token) e
 * rimuove il verifier prima che il useEffect della pagina giri. Chiamare poi
 * exchangeCodeForSession(code) una SECONDA volta fallisce con
 * AuthPKCECodeVerifierMissingError e — nel codice precedente — mandava l'utente a
 * /login?error=oauth_failed NONOSTANTE la sessione fosse già nei cookie (riprodotto in
 * produzione 07/08/2026: POST /token 200 nei log auth + sessione nei cookie + rimbalzo al login).
 *
 * Ordine corretto:
 * 1. getSession() → se la sessione esiste già (detect automatico riuscito), ritorna subito.
 * 2. Solo se non c'è sessione e c'è un code → exchangeCodeForSession esplicito (fallback).
 * 3. Se l'exchange fallisce, ricontrolla getSession() (doppio exchange: la 2ª chiamata
 *    fallisce ma la sessione è stata creata dalla 1ª) → se c'è, ritorna la sessione.
 * 4. Altrimenti ritorna l'errore → il chiamante decide (redirect /login?error=oauth_failed).
 */
export interface OAuthResolveInput {
  code: string | null;
  hash: string;
}

export interface OAuthAuthLike {
  getSession(): Promise<{ data: { session: unknown } }>;
  exchangeCodeForSession(code: string): Promise<{ error: { name?: string; message?: string } | null }>;
}

export async function resolveOAuthSession(
  supabase: OAuthAuthLike,
  { code, hash }: OAuthResolveInput,
): Promise<{ session: unknown; error?: never } | { session?: never; error: { name?: string; message?: string } }> {
  // 1. La sessione esiste già? (detectSessionInUrl l'ha creata all'init della pagina)
  let { data: { session } } = await supabase.getSession();
  if (session) return { session };

  // 2. Fallback: exchange esplicito solo se il detect automatico non ha agito
  if (code) {
    const { error: exchangeErr } = await supabase.exchangeCodeForSession(code);
    if (exchangeErr) {
      // 3. Ricontrolla: il detect automatico può aver creato la sessione (doppio exchange)
      const retry = await supabase.getSession();
      if (retry.data.session) return { session: retry.data.session };
      return { error: exchangeErr };
    }
    // Exchange riuscito: rilegge la sessione appena creata
    const after = await supabase.getSession();
    if (after.data.session) return { session: after.data.session };
    // Edge case estremo: exchange ok ma storage non ancora propagato → errore generico
    return { error: { name: 'OAuthSessionMissingAfterExchange', message: 'Exchange riuscito ma sessione non propagata nello storage' } };
  } else if (hash) {
    // Confirm email flow: token nel fragment URL
    const res = await supabase.getSession();
    return { session: res.data.session };
  }

  // Nessun code né hash: il chiamante manda al login
  return { error: { name: 'NoOAuthCodeError', message: 'Nessun code OAuth né hash nella URL' } };
}
