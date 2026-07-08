import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';

/**
 * Server-side media list for the SPOSI gallery page (`/events/[id]`).
 *
 * Auth policy:
 * - `media_uploads` (foto/video pubblici) sono visibili a chiunque conosce l'event_id
 *   (è già nel QR code condiviso agli invitati — non è un segreto).
 * - `video_messages` (guestbook con video personali) richiedono auth come creator o guest.
 *
 * Per recuperare l'utente loggato usiamo il cookie auth; in mancanza userId non viene
 * esposto alcun video guestbook.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;

    let userId: string | null = null;
    try {
      const cookieStore = await cookies();
      const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
      const { data } = await supabaseAuth.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch {
      // Non autenticato — ok, galleria foto è comunque accessibile
    }

    const svc = createServiceClient();

    // Foto/video pubblici (sempre accessibili a chi conosce l'event_id)
    const { data: media } = await svc
      .from('media_uploads')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    let videoMessages: unknown[] = [];

    // Video guestbook: solo per chi è autenticato come creator o guest registrato
    if (userId) {
      const { data: event } = await svc.from('events').select('created_by').eq('id', eventId).maybeSingle();
      const isCreator = event?.created_by === userId;
      let isGuest = false;
      if (!isCreator) {
        const { data: guest } = await svc.from('event_guests').select('id').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
        isGuest = !!guest;
      }
      if (isCreator || isGuest) {
        const { data } = await svc.from('video_messages').select('*').eq('event_id', eventId).order('created_at', { ascending: false });
        videoMessages = data ?? [];
      }
    }

    return NextResponse.json({ media: media ?? [], videoMessages });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}
