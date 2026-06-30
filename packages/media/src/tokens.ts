import { createServiceClient } from '@fotosposi/core';

export interface EventDriveToken {
  id: string;
  event_id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string;
  drive_email: string | null;
  created_at: string;
  updated_at: string;
}

export async function saveDriveToken(params: {
  event_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  drive_email?: string;
}): Promise<{ token?: EventDriveToken; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_drive_tokens')
    .upsert({
      event_id: params.event_id,
      access_token: params.access_token,
      refresh_token: params.refresh_token,
      token_type: 'Bearer',
      expires_at: params.expires_at,
      drive_email: params.drive_email ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' })
    .select()
    .single();
  if (error) return { error: error.message };
  return { token: data };
}

export async function getDriveToken(eventId: string): Promise<{ token?: EventDriveToken; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_drive_tokens')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) return { error: error.message };
  return { token: data ?? undefined };
}

export async function deleteDriveToken(eventId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('event_drive_tokens').delete().eq('event_id', eventId);
  if (error) return { error: error.message };
  return {};
}

export async function refreshDriveAccessToken(refreshToken: string): Promise<{ access_token?: string; error?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) return { error: data.error_description || data.error };
  return { access_token: data.access_token };
}
