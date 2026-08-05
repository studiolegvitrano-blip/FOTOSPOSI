import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchTracks, upscaleArtwork, setItunesFetchForTests } from '../itunes';

const OK_SEARCH_RESPONSE = {
  resultCount: 1,
  results: [
    {
      trackId: 1441146346,
      trackName: 'A Sky Full of Stars',
      artistId: 1119973,
      artistName: 'Coldplay',
      collectionId: 1441137492,
      collectionName: 'Ghost Stories',
      trackViewUrl: 'https://music.apple.com/it/album/1441146346',
      previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/abc.m4a',
      trackTimeMillis: 268040,
      artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/100x100bb.jpg',
    },
  ],
};

beforeEach(() => {
  setItunesFetchForTests(vi.fn() as unknown as typeof fetch);
});

describe('upscaleArtwork', () => {
  it('converte 100x100bb -> 300x300bb', () => {
    expect(upscaleArtwork('https://x/100x100bb.jpg')).toBe(
      'https://x/300x300bb.jpg',
    );
  });

  it('converte anche 60x60bb e 30x30bb', () => {
    expect(upscaleArtwork('https://x/60x60bb.jpg')).toBe('https://x/300x300bb.jpg');
    expect(upscaleArtwork('https://x/30x30bb.jpg')).toBe('https://x/300x300bb.jpg');
  });
});

describe('searchTracks', () => {
  it('ritorna tracce parsed correttamente (iTunes shape)', async () => {
    setItunesFetchForTests((async (url: string) => {
      expect(url).toContain('itunes.apple.com/search');
      expect(url).toContain('media=music');
      expect(url).toContain('entity=song');
      expect(url).toContain('limit=20');
      expect(url).toContain('term=A%20Sky%20');
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => OK_SEARCH_RESPONSE,
      } as unknown as Response;
    }) as unknown as typeof fetch);

    const result = await searchTracks('A Sky Full of Stars Coldplay');
    expect(result.tracks).toHaveLength(1);
    const t = result.tracks[0];
    expect(t).toBeDefined();
    if (!t) throw new Error('track missing');
    expect(t.id).toBe('1441146346');
    expect(t.name).toBe('A Sky Full of Stars');
    expect(t.artists).toEqual([{ id: '1119973', name: 'Coldplay' }]);
    expect(t.album).toEqual({ id: '1441137492', name: 'Ghost Stories', images: [] });
    expect(t.duration_ms).toBe(268040);
    expect(t.external_url).toBe('https://music.apple.com/it/album/1441146346');
    expect(t.preview_url).toBe('https://audio-ssl.itunes.apple.com/itunes-assets/abc.m4a');
    // art_url = artwork upscaled
    expect(t.art_url).toBe('https://is1-ssl.mzstatic.com/image/thumb/300x300bb.jpg');
  });

  it('query vuota ritorna lista vuota senza chiamare API', async () => {
    const fetchMock = vi.fn();
    setItunesFetchForTests(fetchMock as unknown as typeof fetch);
    const r = await searchTracks('');
    expect(r.tracks).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rispetta limit max 20', async () => {
    setItunesFetchForTests((async (url: string) => {
      expect(url).toMatch(/limit=20/);
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ resultCount: 0, results: [] }),
      } as unknown as Response;
    }) as unknown as typeof fetch);
    await searchTracks('test', 50); // richiesto 50, capped a 20
  });

  it('lancia errore se iTunes risponde non-OK', async () => {
    setItunesFetchForTests((async () => ({
      ok: false,
      status: 500,
      text: async () => 'boom',
      json: async () => ({}),
    }) as unknown) as typeof fetch);
    await expect(searchTracks('test')).rejects.toThrow(/500/);
  });

  it('gestisce campi mancanti (preview/durata/artwork assenti)', async () => {
    setItunesFetchForTests((async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        resultCount: 1,
        results: [
          {
            trackId: 1,
            trackName: 'Titolo',
            artistName: 'Artista',
            trackViewUrl: 'https://music.apple.com/it/album/1',
          },
        ],
      }),
    }) as unknown) as typeof fetch);

    const r = await searchTracks('test');
    const t = r.tracks[0]!;
    expect(t.preview_url).toBeNull();
    expect(t.duration_ms).toBeNull();
    expect(t.art_url).toBeNull();
    expect(t.album).toEqual({ id: null, name: '', images: [] });
  });
});
