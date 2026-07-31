import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSideClient, createServiceClient } from '@fotosposi/core';
import { downloadObjectBuffer } from '@fotosposi/r2-storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const cookieStore = await cookies();
    const supabase = createServerSideClient(() => cookieStore.getAll());
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const svc = createServiceClient();
    let { data: media } = await svc
      .from('media_uploads')
      .select('id, event_id, r2_key, url, type')
      .eq('id', id)
      .maybeSingle();

    if (!media) {
      const { data: videoMessage } = await svc
        .from('video_messages')
        .select('id, event_id, r2_key, url, type')
        .eq('id', id)
        .maybeSingle();
      media = videoMessage;
    }

    if (!media) {
      return NextResponse.json({ error: 'Media non trovato' }, { status: 404 });
    }

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

    // FIX 31/07/2026: scarica il file da R2 via SDK (GetObjectCommand stream) invece
    // di generare una presigned URL e fare redirect. Il presigner cadeva in
    // "b is not a function" su Vercel lambda, quindi tutte le foto/video risultavano
    // invisibili in galleria. Lo stream diretto bypassa il problema e ci da' il pieno
    // controllo sui Cache-Control headers (impediscono il caching di foto private
    // anche in caso di CDN edge).
    const r2Key = media.r2_key || media.url;
    if (!r2Key) {
      return NextResponse.json({ error: 'File non disponibile' }, { status: 404 });
    }

    const buffer = await downloadObjectBuffer(r2Key);
    if (!buffer) {
      return NextResponse.json({ error: 'Download non disponibile' }, { status: 500 });
    }

    // Content-type: foto JPEG/PNG/WEBP o video mp4/webm. Default a octet-stream.
    const ext = r2Key.split('.').pop()?.toLowerCase() ?? '';
    const contentType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      ext === 'gif' ? 'image/gif' :
      ext === 'mp4' ? 'video/mp4' :
      ext === 'webm' ? 'video/webm' :
      'application/octet-stream';

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        // Foto private per ospiti: niente cache su CDN/browser.
        'Cache-Control': 'private, max-age=0, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
