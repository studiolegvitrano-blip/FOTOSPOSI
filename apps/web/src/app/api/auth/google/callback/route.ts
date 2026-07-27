import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { ensureDriveFolders } from '@fotosposi/media';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const eventId = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) return NextResponse.redirect(new URL(`/events/${eventId}/drive?error=${error}`, req.url));
  if (!code || !eventId) return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;
  if (!clientId || !clientSecret) return NextResponse.json({ error: 'OAuth not configured' }, { status: 500 });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();
  if (tokens.error) return NextResponse.redirect(new URL(`/events/${eventId}/drive?error=${encodeURIComponent(tokens.error_description || tokens.error)}`, req.url));

  const supabase = createServiceClient();
  await supabase.from('event_drive_tokens').upsert({
    event_id: eventId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_type: tokens.token_type || 'Bearer',
    expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    drive_email: tokens.email || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'event_id' });

  const { folders } = await ensureDriveFolders(tokens.access_token, 'Sposi.live');
  if (folders) {
    for (const [name, folderId] of Object.entries(folders)) {
      if (folderId) {
        await supabase.from('event_drive_folders').upsert({
          event_id: eventId,
          folder_name: name,
          folder_id: folderId,
        }, { onConflict: 'event_id, folder_name' });
      }
    }
    // Nota: in passato aggiornavamo `drive_folder_id` su event_drive_tokens ma la colonna
    // non esiste (`event_drive_tokens` ha solo access_token/refresh_token/expires_at/drive_email).
    // La folder map è già su `event_drive_folders` e letta via getEventDriveFolders.
  }

  return NextResponse.redirect(new URL(`/events/${eventId}/drive?success=true`, req.url));
}
