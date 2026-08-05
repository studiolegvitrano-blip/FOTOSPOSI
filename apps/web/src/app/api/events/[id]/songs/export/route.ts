import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import { listSongs, exportM3U, buildPlaylistPdfHtml } from '@fotosposi/music';

/**
 * GET /api/events/[id]/songs/export?format=m3u|pdf
 * - m3u → file .m3u scaricabile (Content-Disposition attachment)
 * - pdf → HTML print-friendly (aprire e fare window.print → PDF) da client
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format') ?? 'm3u';
  if (format !== 'm3u' && format !== 'pdf') {
    return NextResponse.json({ error: 'formato non supportato' }, { status: 400 });
  }

  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('couple_name, date, brand')
    .eq('id', eventId)
    .maybeSingle();

  const { songs } = await listSongs(eventId);
  const playlistName = event?.couple_name
    ? `Playlist ${event.couple_name}`
    : 'Playlist Matrimonio';
  const brand = event?.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';

  if (format === 'm3u') {
    const m3u = exportM3U(songs, playlistName);
    return new NextResponse(m3u, {
      status: 200,
      headers: {
        'Content-Type': 'audio/x-mpegurl; charset=utf-8',
        'Content-Disposition': 'attachment; filename="playlist-matrimonio.m3u"',
        'Cache-Control': 'no-store',
      },
    });
  }

  // pdf → HTML print-friendly
  const html = buildPlaylistPdfHtml(songs, {
    playlistName,
    coupleName: event?.couple_name ?? '',
    eventDate: event?.date ? new Date(event.date).toLocaleDateString('it-IT') : '',
    brand,
  });
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
