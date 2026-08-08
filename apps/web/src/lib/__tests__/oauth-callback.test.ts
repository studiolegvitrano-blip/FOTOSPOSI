import { describe, it, expect, vi } from 'vitest';
import { resolveOAuthSession, type OAuthAuthLike } from '../oauth-callback';

function makeAuth(initialSession: unknown = null, exchangeError: { name?: string; message?: string } | null = null, sessionOnRetry: unknown = null): {
  auth: OAuthAuthLike;
  calls: { getSession: number; exchangeCodeForSession: number; lastCode?: string };
} {
  const calls = { getSession: 0, exchangeCodeForSession: 0, lastCode: undefined as string | undefined };
  let currentSession: unknown = initialSession;
  const auth: OAuthAuthLike = {
    getSession: vi.fn(async () => {
      calls.getSession++;
      // Se sessionOnRetry è valorizzato e non siamo alla prima chiamata, ritorna quello
      // (simula: la sessione viene scritta nello storage SOLO dopo l'exchange fallito,
      //  ad esempio da un altro tab o dal race con detectSessionInUrl async)
      if (sessionOnRetry !== null && calls.getSession > 1) {
        return { data: { session: sessionOnRetry } };
      }
      return { data: { session: currentSession } };
    }),
    exchangeCodeForSession: vi.fn(async (code: string) => {
      calls.exchangeCodeForSession++;
      calls.lastCode = code;
      if (exchangeError) {
        // nessuna sessione nuova (caso errore)
      } else {
        currentSession = { user_id: 'from-exchange', code };
      }
      return { error: exchangeError };
    }),
  };
  return { auth, calls };
}

describe('resolveOAuthSession (fix bug double-exchange 07/08/2026)', () => {
  it('ritorna la sessione esistente senza chiamare exchangeCodeForSession (FIX: detect automatico già riuscito)', async () => {
    const existingSession = { user_id: 'existing-from-detect' };
    const { auth, calls } = makeAuth(existingSession);

    const res = await resolveOAuthSession(auth, { code: 'fb-code-xyz', hash: '' });

    expect(res.session).toBe(existingSession);
    expect(calls.getSession).toBe(1);
    expect(calls.exchangeCodeForSession).toBe(0); // niente AuthPKCECodeVerifierMissingError
  });

  it('fa exchange esplicito se non c\'è sessione e c\'è code (fallback: detect automatico non ha agito)', async () => {
    const { auth, calls } = makeAuth(null);

    const res = await resolveOAuthSession(auth, { code: 'fb-code-abc', hash: '' });

    expect(res.error).toBeUndefined();
    expect(res.session).toEqual({ user_id: 'from-exchange', code: 'fb-code-abc' });
    expect(calls.exchangeCodeForSession).toBe(1);
    expect(calls.lastCode).toBe('fb-code-abc');
    expect(calls.getSession).toBeGreaterThanOrEqual(1);
  });

  it('se exchange fallisce ma getSession ritrova la sessione, ritorna la sessione (FIX: doppio exchange, scenario difensivo)', async () => {
    // Scenario difensivo: la prima getSession ritorna null (detect automatico @supabase/ssr
    // non ancora propagato), la nostra exchangeCodeForSession fallisce (es. tab chiuso durante
    // OAuth), MA un altro meccanismo (es. concurrent tab, retry async del client) ha poi
    // scritto la sessione nello storage → la 2ª getSession la ritrova → non mandiamo
    // l'utente al login inutilmente.
    const sessionFromLateWrite = { user_id: 'from-late-write' };
    const { auth, calls } = makeAuth(null, {
      name: 'AuthPKCECodeVerifierMissingError',
      message: 'PKCE code verifier not found in storage',
    }, sessionFromLateWrite);

    const res = await resolveOAuthSession(auth, { code: 'fb-code-double', hash: '' });

    expect(res.session).toBe(sessionFromLateWrite);
    expect(res.error).toBeUndefined();
    expect(calls.exchangeCodeForSession).toBe(1);
    expect(calls.getSession).toBe(2); // iniziale + retry dopo exchange errore
  });

  it('se exchange fallisce e non c\'è sessione, ritorna errore (code reuse / tab chiuso durante OAuth)', async () => {
    const { auth, calls } = makeAuth(null, {
      name: 'AuthPKCECodeVerifierMissingError',
      message: 'PKCE code verifier not found in storage',
    });

    const res = await resolveOAuthSession(auth, { code: 'fb-code-reuse', hash: '' });

    expect(res.session).toBeUndefined();
    expect(res.error).toBeDefined();
    expect(res.error?.name).toBe('AuthPKCECodeVerifierMissingError');
    expect(calls.exchangeCodeForSession).toBe(1);
    expect(calls.getSession).toBe(2);
  });

  it('nessun code né hash → errore NoOAuthCodeError (link diretto a /auth/callback)', async () => {
    const { auth } = makeAuth(null);

    const res = await resolveOAuthSession(auth, { code: null, hash: '' });

    expect(res.session).toBeUndefined();
    expect(res.error?.name).toBe('NoOAuthCodeError');
  });

  it('confirm email flow: solo hash, nessun code → getSession e ritorna', async () => {
    const confirmSession = { user_id: 'confirm-email-user' };
    const { auth, calls } = makeAuth(confirmSession);

    const res = await resolveOAuthSession(auth, { code: null, hash: '#access_token=xxx' });

    expect(res.session).toBe(confirmSession);
    expect(calls.exchangeCodeForSession).toBe(0);
  });
});
