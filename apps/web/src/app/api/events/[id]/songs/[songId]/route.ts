import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import { deleteSong, getSongById } from '@fotosposi/music';

/**
 * DELETE /api/events/[id]/songs/[songId]
 *
 * Permessi (regola feature): sposi (events.created_by) possono cancellare QUALSIASI
 * brano; invitati SOLO i propri (added_by_user_id = auth.uid()). La RLS
 * `songs_event_delete` copre già questo, ma qui usiamo service role (le funzioni
 * deleteSong usa service role) quindi il gate di autorizzazione lo facciamo a mano.
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; songId: string }> },
) {
  const { id: eventId, songId } = await params;
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const song = await getSongById(songId);
  if (!song || song.event_id !== eventId) {
    return NextResponse.json({ error: 'Brano non trovato' }, { status: 404 });
  }

  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .maybeSingle();

  const isCreator = !!event && event.created_by === userId;
  const isOwner = song.added_by_user_id === userId;

  if (!isCreator && !isOwner) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
  }

  const ok = await deleteSong(songId);
  if (!ok) {
    return NextResponse.json({ error: 'Errore cancellazione brano' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
