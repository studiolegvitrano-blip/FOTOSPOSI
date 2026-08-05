import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSideClient } from '@fotosposi/core';
import { searchTracks, ensureSpotifyCredentials } from '@fotosposi/music';

/**
 * GET /api/spotify/search?q=...&limit=20
 * Proxy server-side per la ricerca brani Spotify (Client Credentials flow).
 * Il token (cache module-level) non deve MAI andare nel browser.
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

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q');
  if (!q || !q.trim()) {
    return NextResponse.json({ tracks: [] });
  }

  const creds = ensureSpotifyCredentials();
  if (!creds.ok) {
    return NextResponse.json({ error: creds.reason }, { status: 503 });
  }

  const limitRaw = Number(request.nextUrl.searchParams.get('limit') ?? '20');
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, Math.floor(limitRaw))) : 20;

  try {
    const { tracks } = await searchTracks(q, limit);
    return NextResponse.json({ tracks });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore ricerca Spotify' },
      { status: 500 },
    );
  }
}
