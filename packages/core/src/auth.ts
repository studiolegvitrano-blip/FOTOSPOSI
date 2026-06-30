import { createClient, createServiceClient } from './supabase';
import type { AuthToken } from './index';

export async function signUp(email: string, password: string, name: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
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
