import { NextRequest, NextResponse } from 'next/server';
import { createVideoMessage, getVideoMessages } from '@fotosposi/media';

/**
 * Server-side proxy for video guestbook messages.
 *
 * `createVideoMessage`/`getVideoMessages` already call `createServiceClient()`, but that function
 * silently falls back to the anon key when run in the browser (the real service role key is a
 * server-only env var, stripped from the client bundle). `video_messages` has no public/anon RLS
 * policy at all, so calling these directly from the guestbook page ('use client') always failed
 * under RLS once the schema issue was fixed. Running them here, server-side, gives them the real
 * service role key and lets them work as intended.
 */
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId');
  const type = req.nextUrl.searchParams.get('type') as 'welcome' | 'guestbook' | null;
  if (!eventId) return NextResponse.json({ error: 'eventId mancante' }, { status: 400 });

  const { messages, error } = await getVideoMessages(eventId, type ?? undefined);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { event_id, from_user, from_name, type, url, r2_key, is_public } = body;
  if (!event_id || !from_user || !type || !url) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
  }

  const { message, error } = await createVideoMessage({
    event_id,
    from_user,
    from_name,
    type,
    url,
    r2_key,
    is_public,
  });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ message });
}
