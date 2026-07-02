import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@fotosposi/core';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const svc = createServiceClient();
    const { data: media, error: mediaError } = await svc
      .from('media_uploads')
      .select('id, event_id, r2_key, url')
      .eq('id', id)
      .single();

    if (mediaError || !media) {
      return NextResponse.json({ error: 'Media non trovato' }, { status: 404 });
    }

    // Verifica che l'utente appartenga all'evento
    const { data: membership } = await svc
      .from('core_users')
      .select('id')
      .eq('id', user.id)
      .eq('event_id', media.event_id)
      .maybeSingle();

    // Se non è membro diretto, controlla se è creator dell'evento
    let authorized = !!membership;
    if (!authorized) {
      const { data: ev } = await svc
        .from('events')
        .select('created_by')
        .eq('id', media.event_id)
        .single();
      authorized = ev?.created_by === user.id;
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
