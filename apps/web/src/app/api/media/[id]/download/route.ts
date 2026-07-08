import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSideClient, createServiceClient } from '@fotosposi/core';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // FIX: prima qui c'era `createClient()` (client BROWSER di Supabase) — in una route server
    // non vede i cookie di sessione, quindi `getUser()` falliva SEMPRE → 401 per ogni richiesta.
    // Risultato: né le foto in galleria né i video del guestbook si caricavano mai (img/video
    // con src su questo endpoint restavano vuoti). Serve il client server-side coi cookie.
    const cookieStore = await cookies();
    const supabase = createServerSideClient(() => cookieStore.getAll());
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const svc = createServiceClient();
    let { data: media } = await svc
      .from('media_uploads')
      .select('id, event_id, r2_key, url')
      .eq('id', id)
      .maybeSingle();

    // I video del Video Guestbook vivono nella tabella `video_messages`, non `media_uploads` —
    // senza questo fallback questo endpoint restituiva sempre 404 per quei video (si vedeva la
    // card nella lista ma il player non aveva mai un src valido da caricare).
    if (!media) {
      const { data: videoMessage } = await svc
        .from('video_messages')
        .select('id, event_id, r2_key, url')
        .eq('id', id)
        .maybeSingle();
      media = videoMessage;
    }

    if (!media) {
      return NextResponse.json({ error: 'Media non trovato' }, { status: 404 });
    }

    // Verifica autorizzazione: creator dell'evento O ospite registrato
    // (non usiamo core_users.event_id perché è quasi sempre NULL — bug noto)
    const { data: ev } = await svc
      .from('events')
      .select('created_by')
      .eq('id', media.event_id)
      .maybeSingle();

    let authorized = ev?.created_by === user.id;
    if (!authorized) {
      const { data: guest } = await svc
        .from('event_guests')
        .select('id')
        .eq('event_id', media.event_id)
        .eq('user_id', user.id)
        .maybeSingle();
      authorized = !!guest;
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    // Usa r2_key oppure url (backward compat)
    const r2Key = media.r2_key || media.url;
    const downloadUrl = await getPresignedDownloadUrl(r2Key, 3600);

    if (!downloadUrl) {
      return NextResponse.json({ error: 'URL download non disponibile' }, { status: 500 });
    }

    return NextResponse.redirect(downloadUrl);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
