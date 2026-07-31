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

    // FIX 31/07/2026: arricchisce ogni media con `uploader_name` e `uploader_role_at_event`
    // per mostrare "Mario Rossi — Testimone" sotto ogni foto in galleria. Senza questo,
    // l'utente che guarda la galleria non sa CHI ha caricato la foto — informazione utile
    // per riconoscere i contributori e per il senso di community del matrimonio.
    // Usiamo una singola query su core_users per gli uploader distinti, e mappiamo in memoria.
    let uploaderInfoMap: Record<string, { name?: string; role_at_event?: string; first_name?: string; last_name?: string }> = {};
    if (media && media.length > 0) {
      const uploaderIds = Array.from(new Set(media.map((m: any) => m.uploaded_by).filter(Boolean)));
      if (uploaderIds.length > 0) {
        const { data: uploaders } = await svc
          .from('core_users')
          .select('id, first_name, last_name, name, role_at_event')
          .in('id', uploaderIds);
        uploaderInfoMap = Object.fromEntries(
          (uploaders ?? []).map((u: any) => [u.id, u]),
        );
      }
    }
    const enrichedMedia = (media ?? []).map((m: any) => {
      const u = uploaderInfoMap[m.uploaded_by];
      const uploaderName = u ? (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.name) : undefined;
      return { ...m, uploader_name: uploaderName, uploader_role_at_event: u?.role_at_event ?? null };
    });

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

    return NextResponse.json({ media: enrichedMedia, videoMessages });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}
