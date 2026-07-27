// packages/video-overlay/src/remote.test.ts
// Test per l'adapter VPS: brandingToRemote (puro) + applyVideoOverlayRemote
// (con fetch mockato). Non testiamo integrazione end-to-end col vero ffmpeg:
// quello richiede un VPS vero, fuori dal CI del monorepo.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyVideoOverlayRemote,
  isVpsWatermarkConfigured,
  VpsNotConfiguredError,
} from './remote';
import { brandingToRemote } from './index';

const originalEnv = { ...process.env };

function setVps() {
  process.env.VPS_FFMPEG_URL = 'https://vps.example';
  process.env.VPS_FFMPEG_API_KEY = 'test-key-123';
}

function clearVps() {
  delete process.env.VPS_FFMPEG_URL;
  delete process.env.VPS_FFMPEG_API_KEY;
}

describe('video-overlay remote', () => {
  beforeEach(() => {
    clearVps();
  });
  afterEach(() => {
    clearVps();
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('isVpsWatermarkConfigured', () => {
    it('false quando VPS_FFMPEG_URL mancante', () => {
      process.env.VPS_FFMPEG_API_KEY = 'k';
      expect(isVpsWatermarkConfigured()).toBe(false);
    });
    it('false quando VPS_FFMPEG_API_KEY mancante', () => {
      process.env.VPS_FFMPEG_URL = 'https://x';
      expect(isVpsWatermarkConfigured()).toBe(false);
    });
    it('true quando entrambe presenti', () => {
      setVps();
      expect(isVpsWatermarkConfigured()).toBe(true);
    });
  });

  describe('brandingToRemote', () => {
    it('mapping base senza logoPng', () => {
      const out = brandingToRemote({
        coupleNames: 'Marco & Anna',
        date: '2026-08-25',
        primaryColor: '#d4a574',
        textColor: '#fff',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
      } as never);
      expect(out.coupleNames).toBe('Marco & Anna');
      expect(out.primaryColor).toBe('#d4a574');
      expect(out.wordmark).toBe('Sposi.live');
      expect(out.fontFamily).toBe('Playfair Display');
      expect(out.logoBase64).toBeUndefined();
      expect(out.logoMimeType).toBeUndefined();
    });

    it('logoPng Buffer serializzato in base64 + mime png', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // magic PNG
      const out = brandingToRemote({
        coupleNames: 'A & B',
        date: '',
        primaryColor: '#000',
        wordmark: 'w',
        logoPng: png,
      } as never);
      expect(out.logoBase64).toBe(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString('base64'));
      expect(out.logoMimeType).toBe('image/png');
    });

    it('logoPng vuoto NON viene serializzato (nessun logoBase64)', () => {
      const out = brandingToRemote({
        coupleNames: '',
        date: '',
        primaryColor: '#000',
        wordmark: 'w',
        logoPng: Buffer.alloc(0),
      } as never);
      expect(out.logoBase64).toBeUndefined();
    });
  });

  describe('applyVideoOverlayRemote', () => {
    it('throw VpsNotConfiguredError se env mancanti', async () => {
      clearVps();
      await expect(
        applyVideoOverlayRemote({
          downloadUrl: 'https://x/dl',
          uploadUrl: 'https://x/ul',
          branding: {
            coupleNames: 'A & B',
            date: '2026',
            primaryColor: '#000',
            wordmark: 'w',
          },
        }),
      ).rejects.toBeInstanceOf(VpsNotConfiguredError);
    });

    it('chiama POST {VPS_FFMPEG_URL}/watermark con headers corretti', async () => {
      setVps();
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, bytes: 1234, durationMs: 500 }),
      } as Response);

      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const result = await applyVideoOverlayRemote({
        downloadUrl: 'https://r2.example/dl',
        uploadUrl: 'https://r2.example/ul',
        branding: { coupleNames: 'A & B', date: '2026', primaryColor: '#000', wordmark: 'w' },
      });
      expect(result.ok).toBe(true);
      expect(result.bytes).toBe(1234);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://vps.example/watermark');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['X-API-Key']).toBe('test-key-123');
      expect(JSON.parse(init.body as string)).toMatchObject({
        downloadUrl: 'https://r2.example/dl',
        uploadUrl: 'https://r2.example/ul',
        branding: { coupleNames: 'A & B', primaryColor: '#000', wordmark: 'w' },
      });
    });

    it('VPS risponde {ok:false}: ritorna {ok:false,error}', async () => {
      setVps();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ ok: false, error: 'ffmpeg failed' }),
      } as unknown as Response);

      const result = await applyVideoOverlayRemote({
        downloadUrl: 'https://x/dl',
        uploadUrl: 'https://x/ul',
        branding: { coupleNames: '', date: '', primaryColor: '#000', wordmark: 'w' },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('ffmpeg failed');
    });

    it('VPS risponde 200 ma ok=false nel body: ritorna {ok:false,error}', async () => {
      setVps();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: false, error: 'ffprobe timeout' }),
      } as unknown as Response);

      const result = await applyVideoOverlayRemote({
        downloadUrl: 'https://x/dl',
        uploadUrl: 'https://x/ul',
        branding: { coupleNames: '', date: '', primaryColor: '#000', wordmark: 'w' },
      });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('ffprobe timeout');
    });

    it('Endpoint con trailing slash viene normalizzato', async () => {
      setVps();
      process.env.VPS_FFMPEG_URL = 'https://vps.example/';
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, bytes: 0, durationMs: 0 }),
      } as unknown as Response);

      await applyVideoOverlayRemote({
        downloadUrl: 'https://x/dl',
        uploadUrl: 'https://x/ul',
        branding: { coupleNames: '', date: '', primaryColor: '#000', wordmark: 'w' },
      });
      const callUrl = (globalThis.fetch as unknown as { mock: { calls: [string, unknown][] } }).mock.calls[0][0];
      expect(callUrl).toBe('https://vps.example/watermark');
    });
  });
});
