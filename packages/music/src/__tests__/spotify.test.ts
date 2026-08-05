import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  searchTracks,
  getSpotifyToken,
  isSpotifyConfigured,
  resetSpotifyCacheForTests,
  setSpotifyFetchForTests,
} from '../spotify';

const OK_TOKEN_RESPONSE = {
  access_token: 'test-access-token',
  expires_in: 3600,
};

const OK_SEARCH_RESPONSE = {
  tracks: {
    items: [
      {
        id: '6DCZcDsp4o0Qza7Hgv4z0E',
        name: 'A Sky Full of Stars',
        uri: 'spotify:track:6DCZcDsp4o0Qza7Hgv4z0E',
        external_urls: { spotify: 'https://open.spotify.com/track/6DCZcDsp4o0Qza7Hgv4z0E' },
        preview_url: 'https://p.scdn.co/mp3-preview/abc',
        duration_ms: 268_040,
        artists: [{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'Coldplay' }],
        album: {
          id: 'album-1',
          name: 'Ghost Stories',
          images: [
            { url: 'https://i.scdn.co/large.jpg', width: 640, height: 640 },
            { url: 'https://i.scdn.co/small.jpg', width: 64, height: 64 },
          ],
        },
      },
    ],
  },
};

beforeEach(() => {
  process.env.SPOTIFY_CLIENT_ID = 'test-client-id';
  process.env.SPOTIFY_CLIENT_SECRET = 'test-client-secret';
  resetSpotifyCacheForTests();
});

describe('isSpotifyConfigured', () => {
  it('true quando env presenti', () => {
    expect(isSpotifyConfigured()).toBe(true);
  });

  it('false quando env mancanti', () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    expect(isSpotifyConfigured()).toBe(false);
  });
});

describe('getSpotifyToken', () => {
  it('ottiene token via Client Credentials e cache', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === 'https://accounts.spotify.com/api/token') {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => OK_TOKEN_RESPONSE,
        } as unknown as Response;
      }
      throw new Error('unexpected url ' + url);
    });
    setSpotifyFetchForTests(fetchMock as unknown as typeof fetch);

    const t1 = await getSpotifyToken();
    expect(t1).toBe('test-access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // cached — no second fetch
    const t2 = await getSpotifyToken();
    expect(t2).toBe('test-access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lancia errore se Spotify non configurato', async () => {
    delete process.env.SPOTIFY_CLIENT_SECRET;
    await expect(getSpotifyToken()).rejects.toThrow(
      /Spotify non configurato/,
    );
  });

  it('lancia errore se Spotify risponde non-OK', async () => {
    setSpotifyFetchForTests((async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid_client',
      json: async () => ({}),
    }) as unknown) as typeof fetch);
    await expect(getSpotifyToken()).rejects.toThrow(/401/);
  });
});

describe('searchTracks', () => {
  it('ritorna tracce parsed correttamente', async () => {
    let call = 0;
    setSpotifyFetchForTests((async (url: string) => {
      call++;
      if (url === 'https://accounts.spotify.com/api/token') {
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => OK_TOKEN_RESPONSE,
        } as unknown as Response;
      }
      if (url.startsWith('https://api.spotify.com/v1/search')) {
        expect(url).toContain('type=track');
        expect(url).toContain('limit=20');
        expect(url).toContain('q=A%20Sky%20');
        return {
          ok: true,
          status: 200,
          text: async () => '',
          json: async () => OK_SEARCH_RESPONSE,
        } as unknown as Response;
      }
      throw new Error('unexpected url ' + url);
    }) as unknown as typeof fetch);

    const result = await searchTracks('A Sky Full of Stars Coldplay');
    expect(result.tracks).toHaveLength(1);
    const t = result.tracks[0];
    expect(t).toBeDefined();
    if (!t) throw new Error('track missing');
    expect(t.id).toBe('6DCZcDsp4o0Qza7Hgv4z0E');
    expect(t.name).toBe('A Sky Full of Stars');
    expect(t.artists).toEqual([{ id: '4gzpq5DPGxSnKTe4SA8HAU', name: 'Coldplay' }]);
    expect(t.duration_ms).toBe(268_040);
    expect(t.external_url).toBe('https://open.spotify.com/track/6DCZcDsp4o0Qza7Hgv4z0E');
    // art_url = smallest image
    expect(t.art_url).toBe('https://i.scdn.co/small.jpg');
  });

  it('query vuota ritorna lista vuota senza chiamare API', async () => {
    const fetchMock = vi.fn();
    setSpotifyFetchForTests(fetchMock as unknown as typeof fetch);
    const r = await searchTracks('');
    expect(r.tracks).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rispetta limit max 20', async () => {
    setSpotifyFetchForTests((async (url: string) => {
      if (url === 'https://accounts.spotify.com/api/token') {
        const r1: Response = ({
          ok: true,
          json: async () => OK_TOKEN_RESPONSE,
        } as unknown) as Response;
        return r1;
      }
      expect(url).toMatch(/limit=20/);
      const r2: Response = ({
        ok: true,
        json: async () => ({ tracks: { items: [] } }),
      } as unknown) as Response;
      return r2;
    }) as unknown as typeof fetch);
    await searchTracks('test', 50); // richiesto 50, capped a 20
  });
});
