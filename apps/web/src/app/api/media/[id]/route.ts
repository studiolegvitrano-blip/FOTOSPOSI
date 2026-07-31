import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import { deleteMediaById } from '@fotosposi/media';

/**
 * DELETE /api/media/[id] — Cancella una foto/video dalla galleria evento.
 *
 * Autorizzazione: solo lo sposo (events.created_by) o un delegato (event_managers con
 * permission 'edit' o 'admin') possono cancellare. Gli invitati NON possono cancellare
 * foto caricate da altri (per evitare abusi), ma possono cancellare le PROPRIE foto (vedi
 * `uploaded_by === userId` fallback).
 *
 * Cosa viene cancellato:
 *   1. Riga `media_uploads` (record DB)
 *   2. File R2 watermarked (`r2_key`)
 *   3. File R2 originale (`original_r2_key`, se presente per record post-migration 00040)
 *   4. File Google Drive (best-effort, se drive_file_id presente e token Drive attivo)
 *
 * Non viene cancellato: il backup originale su Drive (se l'utente vuole mantenere anche
 * dopo la cancellazione dalla galleria pubblica). Il pattern "cestino" dei social: sparisce
 * dal feed ma resta nello storage permanente dello sposo.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: mediaId } = await params;
    if (!mediaId) {
      return NextResponse.json({ error: 'ID media mancante' }, { status: 400 });
    }

    // Autenticazione: leggi userId dai cookie auth
    let userId: string | null = null;
    try {
      const cookieStore = await cookies();
      const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
      const { data } = await supabaseAuth.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch { /* pubblico bloccato più sotto */ }

    if (!userId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const svc = createServiceClient();

    // Carica media + event.created_by + verifica permessi in una volta
    const { data: media, error: mediaErr } = await svc
      .from('media_uploads')
      .select('id, event_id, uploaded_by')
      .eq('id', mediaId)
      .maybeSingle();

    if (mediaErr) return NextResponse.json({ error: mediaErr.message }, { status: 500 });
    if (!media) return NextResponse.json({ error: 'Media non trovato' }, { status: 404 });

    // Carica evento per conoscere created_by
    const { data: event } = await svc
      .from('events')
      .select('created_by')
      .eq('id', media.event_id)
      .maybeSingle();

    if (!event) {
      return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
    }

    const isCreator = event.created_by === userId;
    const isUploader = media.uploaded_by === userId;

    // Verifica delegato (event_managers con permission 'edit' o 'admin')
    let isManager = false;
    if (!isCreator && !isUploader) {
      const { data: managerRow } = await svc
        .from('event_managers')
        .select('permission')
        .eq('event_id', media.event_id)
        .eq('user_id', userId)
        .in('permission', ['edit', 'admin'])
        .maybeSingle();
      isManager = !!managerRow;
    }

    if (!isCreator && !isManager && !isUploader) {
      return NextResponse.json(
        { error: 'Non hai i permessi per cancellare questo media. Solo lo sposo, un delegato o chi ha caricato la foto possono cancellarla.' },
        { status: 403 },
      );
    }

    // Procedi con la cancellazione (record DB + R2 + Drive best-effort)
    const { ok, error } = await deleteMediaById(mediaId);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}
