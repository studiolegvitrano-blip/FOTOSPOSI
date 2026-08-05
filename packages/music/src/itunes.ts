// iTunes Search API — ricerca brani senza autenticazione né API key.
// Provider scelto il 05/08/2026: la Web API Spotify richiede abbonamento Premium
// (la ricognizione gratuita del 2024 non copre tutti gli account) e blocca la
// ricerca. iTunes Search API è gratis, senza token, con anteprima 30s + artwork.
// Endpoint: GET https://itunes.apple.com/search?media=music&entity=song&term=...

export interface ITunesArtist {
  id: string;
  name: string;
}

export interface ITunesAlbum {
  id: string | null;
  name: string;
  images: Array<{ url: string; width: number | null; height: number | null }>;
}

export interface TrackItem {
  id: string;
  name: string;
  uri: string;
  external_url: string;
  preview_url: string | null;
  duration_ms: number | null;
  artists: ITunesArtist[];
  album: ITunesAlbum;
  art_url: string | null;
}

export interface TrackSearchResult {
  tracks: TrackItem[];
}

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';

/** DIP injectable per test. */
let fetchFn: (url: string, init?: RequestInit) => Promise<Response> = (u, i) =>
  fetch(u, i);

export function setItunesFetchForTests(fn: typeof fetch): void {
  fetchFn = fn;
}

/**
 * iTunes artwork si scarica nella taglia richiesta sostituendo il suffisso.
 * "100x100bb" → "300x300bb" (taglia media, buona per thumbnails ~40px e feed).
 */
export function upscaleArtwork(url: string, size = 300): string {
  return url
    .replace(/100x100bb/, `${size}x${size}bb`)
    .replace(/60x60bb/, `${size}x${size}bb`)
    .replace(/30x30bb/, `${size}x${size}bb`);
}

/**
 * Cerca brani su iTunes (entity=song, media=music).
 * Nessuna credenziale richiesta. Limit clampato 1..20.
 */
export async function searchTracks(
  query: string,
  limit = 20,
): Promise<TrackSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) return { tracks: [] };

  const capped = Math.max(1, Math.min(20, Math.floor(limit)));
  const url =
    `${ITUNES_SEARCH_URL}?media=music&entity=song&country=IT&limit=${capped}` +
    `&term=${encodeURIComponent(trimmed)}`;

  const resp = await fetchFn(url);

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`iTunes search error ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as {
    resultCount: number;
    results?: Array<{
      trackId: number;
      trackName: string;
      artistId?: number;
      artistName: string;
      collectionId?: number;
      collectionName?: string;
      trackViewUrl: string;
      previewUrl?: string | null;
      trackTimeMillis?: number | null;
      artworkUrl100?: string;
      artworkUrl60?: string;
      artworkUrl30?: string;
    }>;
  };

  const items = data.results ?? [];
  const tracks: TrackItem[] = items.map((r) => {
    const art =
      r.artworkUrl100 ||
      r.artworkUrl60 ||
      r.artworkUrl30 ||
      null;
    return {
      id: String(r.trackId),
      name: r.trackName,
      uri: r.trackViewUrl,
      external_url: r.trackViewUrl,
      preview_url: r.previewUrl ?? null,
      duration_ms: r.trackTimeMillis ?? null,
      artists: [{ id: String(r.artistId ?? ''), name: r.artistName }],
      album: {
        id: r.collectionId != null ? String(r.collectionId) : null,
        name: r.collectionName ?? '',
        images: [],
      },
      art_url: art ? upscaleArtwork(art) : null,
    };
  });

  return { tracks };
}
