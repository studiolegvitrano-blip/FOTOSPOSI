import { createClient, createServiceClient } from './supabase';
import type { AuthToken } from './index';

// `redirectPath` è la pagina a cui tornare dopo il login (es. l'invito/evento da cui l'ospite
// arrivava prima di dover fare login) — senza questo, un ospite che clicca "Carica" da un QR
// code, si registra/logga, e finisce sempre su /dashboard invece che sull'evento a cui era stato
// invitato ("perde l'invito").
export async function signInWithOAuth(provider: 'google' | 'facebook', redirectPath?: string) {
  const supabase = createClient();
  const callback = `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath || '/dashboard')}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback },
  });
  return { data, error };
}

export interface SignUpExtra {
  firstName?: string;
  lastName?: string;
  phone?: string;
  marketingConsent?: boolean;
}

export async function signUp(email: string, password: string, name: string, extra?: SignUpExtra, redirectPath?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, ...extra },
      // Without this, Supabase falls back to the project's single static "Site URL" setting
      // (still pointing at http://localhost:3000, a leftover dev default) for the confirmation
      // email link — broken for every real signup in production. window.location.origin makes
      // it correctly point back to sposi.live or justmarry.live, whichever the user signed up on.
      // Passa per /auth/callback (non più direttamente /login) così la sessione creata dal click
      // sul link di conferma viene raccolta e l'utente torna esattamente alla pagina da cui era
      // partito (es. l'evento invitato via QR) invece di un generico /dashboard.
      emailRedirectTo: typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectPath || '/dashboard')}`
        : undefined,
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

// Recupero password — prima non esisteva nessuna schermata per questo (segnalato in una sessione
// precedente: "MANCA L'IMPOSTAZIONE PER RECUPERARLA"), quindi un admin/sposo che aveva dimenticato
// la password, o che si era registrato solo via Google/Facebook/Apple (nessuna password impostata
// su Supabase Auth) e voleva anche il login con email+password, non aveva alcun modo di uscirne.
export async function requestPasswordReset(email: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
  });
  return { error };
}

export async function updatePassword(newPassword: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function validateQrToken(token: string): Promise<{
  valid: boolean;
  event_id?: string;
  role?: string;
  error?: string;
}> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('core_auth_tokens')
    .select('*')
    .eq('token', token)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return { valid: false, error: 'Token non valido o scaduto' };
  }

  return { valid: true, event_id: data.event_id, role: data.role };
}

export async function createQrToken(
  eventId: string,
  role: 'sposo' | 'organizzatore' | 'invitato',
  expiresAt: Date,
): Promise<{ token?: AuthToken; error?: string }> {
  const supabase = createServiceClient();
  const rawToken = crypto.randomUUID();
  const { data, error } = await supabase
    .from('core_auth_tokens')
    .insert({
      event_id: eventId,
      token: rawToken,
      role,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { token: data };
}
