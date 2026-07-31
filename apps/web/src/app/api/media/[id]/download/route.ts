import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient } from '@fotosposi/core';
import { downloadObjectBuffer } from '@fotosposi/r2-storage';

/**
 * Verifica l'utente autenticato leggendo il JWT direttamente dai cookie Supabase,
 * SENZA chiamare `supabase.auth.getUser()`. Il client Supabase SSR prova a
 * refreshare il token durante getUser(), e quel path cade in "b is not a
 * function" sul middleware stack di @supabase/ssr bundlato da Vercel (chunk
 * 5531.js), rendendo la route inutilizzabile anche per utenti con sessione
 * valida. Decodifica manuale del payload per ottenere user.id.
 */
async function getUserIdFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const all = await cookieStore.getAll();
  // Supabase usa due cookie chunked: sb-{ref}-auth-token.0 + .1
  // (chunked storage quando il cookie > 4KB). Usiamo le stesse funzioni
  // della libreria @supabase/ssr per ricostruire il payload completo.
  const { combineChunks, stringFromBase64URL } = await import('@supabase/ssr');
  const chunk0 = all.find((c) => c.name.endsWith('-auth-token.0'));
  if (!chunk0) return null;
  try {
    const key = chunk0.name.replace(/\.0$/, '');
    const combined = await combineChunks(key, async (chunkName: string) => {
      const c = all.find((x) => x.name === chunkName);
      return c?.value ?? null;
    });
    if (!combined) return null;
    let decoded = combined;
    if (decoded.startsWith('base64-')) {
      decoded = stringFromBase64URL(decoded.substring('base64-'.length));
    }
    const payload = JSON.parse(decoded) as { user?: { id?: string } };
    return payload.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // FIX 31/07/2026: bypass getUser() per evitare il refresh token buggato su
    // Vercel lambda ("b is not a function" in chunk 5531.js). Leggiamo il JWT
    // dal cookie. Se scaduto, ritorniamo 401 in modo che il browser re-autentichi.
    const userId = await getUserIdFromCookie();
    if (!userId) {
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

    let authorized = ev?.created_by === userId;
    if (!authorized) {
      const { data: guest } = await svc
        .from('event_guests')
        .select('id')
        .eq('event_id', media.event_id)
        .eq('user_id', userId)
        .maybeSingle();
      authorized = !!guest;
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
    }

    const r2Key = media.r2_key || media.url;
    if (!r2Key) {
      return NextResponse.json({ error: 'File non disponibile' }, { status: 404 });
    }

    const buffer = await downloadObjectBuffer(r2Key);
    if (!buffer) {
      return NextResponse.json({ error: 'Download non disponibile' }, { status: 500 });
    }

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
