// Spotify Web API — Client Credentials flow (no login utente, solo search brani)
// Richiede env: SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET
// Token cached lato server (modulo), TTL Spotify ~3600s, refresh automatico

export interface SpotifyArtist {
  id: string;
  name: string;
}

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  external_url: string;
  preview_url: string | null;
  duration_ms: number;
  artists: SpotifyArtist[];
  album: {
    id: string;
    name: string;
    images: SpotifyImage[];
  };
  art_url: string | null;
}

export interface SpotifySearchResult {
  tracks: SpotifyTrack[];
}

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

/** DIP injectable per test. */
let fetchFn: (url: string, init?: RequestInit) => Promise<Response> =
  (u, i) => fetch(u, i);

export function setSpotifyFetchForTests(fn: typeof fetch): void {
  fetchFn = fn;
}

export function resetSpotifyCacheForTests(): void {
  cachedToken = null;
}

function getCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID || '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isSpotifyConfigured(): boolean {
  return getCredentials() !== null;
}

/**
 * Ottiene access token Spotify via Client Credentials flow.
 * Memorizza in cache fino a expiresAt - 60s safety.
 */
export async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const creds = getCredentials();
  if (!creds) {
    throw new Error('Spotify non configurato: mancano SPOTIFY_CLIENT_ID/SECRET');
  }

  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
    'base64',
  );

  const resp = await fetchFn(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Spotify token error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.accessToken;
}

/**
 * Cerca brani su Spotify (type=track, limit 20 max).
 * Query es: "A Sky Full of Stars Coldplay".
 */
export async function searchTracks(
  query: string,
  limit = 20,
): Promise<SpotifySearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { tracks: [] };

  const token = await getSpotifyToken();
  const url = `${SPOTIFY_SEARCH_URL}?type=track&limit=${Math.max(
    1,
    Math.min(20, limit),
  )}&q=${encodeURIComponent(trimmed)}`;

  const resp = await fetchFn(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Spotify search error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as {
    tracks?: {
      items?: Array<{
        id: string;
        name: string;
        uri: string;
        external_urls: { spotify: string };
        preview_url: string | null;
        duration_ms: number;
        artists: Array<{ id: string; name: string }>;
        album: {
          id: string;
          name: string;
          images: SpotifyImage[];
        };
      }>;
    };
  };

  const items = data.tracks?.items ?? [];
  const tracks: SpotifyTrack[] = items.map((it) => {
    const art =
      it.album.images.sort((a, b) => {
        const aw = a.width ?? 0;
        const bw = b.width ?? 0;
        return aw - bw; // ascending: prendiamo la più piccola per art_url
      })[0]?.url ?? null;

    return {
      id: it.id,
      name: it.name,
      uri: it.uri,
      external_url: it.external_urls.spotify,
      preview_url: it.preview_url,
      duration_ms: it.duration_ms,
      artists: it.artists.map((a) => ({ id: a.id, name: a.name })),
      album: {
        id: it.album.id,
        name: it.album.name,
        images: it.album.images,
      },
      art_url: art,
    };
  });

  return { tracks };
}
