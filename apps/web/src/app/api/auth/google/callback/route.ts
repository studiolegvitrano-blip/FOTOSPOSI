import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const eventId = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) return NextResponse.redirect(new URL(`/events/${eventId}/drive?error=${error}`, req.url));
  if (!code || !eventId) return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;
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
  if (tokens.error) return NextResponse.redirect(new URL(`/events/${eventId}/drive?error=${tokens.error_description || tokens.error}`, req.url));

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

  return NextResponse.redirect(new URL(`/events/${eventId}/drive?success=true`, req.url));
}
