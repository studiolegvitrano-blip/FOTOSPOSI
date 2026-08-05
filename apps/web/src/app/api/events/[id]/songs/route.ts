import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import { addSong, listSongs } from '@fotosposi/music';
import type { SpotifyTrack } from '@fotosposi/music';

/**
 * Colonna sonora condivisa — POST aggiunge un brano, GET lista brani.
 *
 * `addSong`/`listSongs` usano `createServiceClient()` (service role, bypass RLS), che
 * nel browser degrada all'anon key. Le policy RLS `songs_event_read/insert` coprono
 * sposi + invitati, quindi per sicurezza l'autorizzazione la gestiamo qui lato server:
 * utente autenticato (getUser) richiesto, accesso ad event_songs per l'evento.
 */

export const runtime = 'nodejs';

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
    const { data } = await supabaseAuth.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { songs, total } = await listSongs(eventId);
  return NextResponse.json({ songs, total });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  let body: { track?: SpotifyTrack; added_by_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  if (!body?.track || !body.track.id || !body.track.external_url) {
    return NextResponse.json({ error: 'track Spotify non valida' }, { status: 400 });
  }

  // Brand derivato dall'evento (sposi.live vs justmarry.live), non dal client.
  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('brand')
    .eq('id', eventId)
    .maybeSingle();
  const brand = event?.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';

  const result = await addSong({
    event_id: eventId,
    track: body.track,
    added_by_user_id: userId,
    added_by_name: typeof body.added_by_name === 'string' ? body.added_by_name : null,
    brand,
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ id: result.id }, { status: 201 });
}
