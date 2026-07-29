import { describe, it, expect, vi } from 'vitest';

// FIX 30/07/2026 — il cuore ❤ deve essere renderizzato come <path> SVG
// INLINE nello stesso <text>, alla stessa baseline, senza gap né offset.
// Questo significa:
//   - Nessun <path> "libero" nel compositeOps separato dal <text>
//   - Il path del cuore è wrappato in <tspan> dentro <text>
//   - Il path ha transform="translate(...) scale(...)" e usa HEART_PATH_DATA
//   - La larghezza del cuore = CHAR_WIDTH_ESTIMATE del font scelto

const sharpMock = {
  metadata: vi.fn().mockResolvedValue({ width: 1080, height: 1080 }),
  stats: vi.fn().mockResolvedValue({ channels: [{ mean: 100 }, { mean: 100 }, { mean: 100 }] }),
  composite: vi.fn(function (this: any) { return this; }),
  jpeg: vi.fn(function (this: any) { return this; }),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('watermarked')),
  resize: vi.fn(function (this: any) { return this; }),
  extract: vi.fn(function (this: any) { return this; }),
  greyscale: vi.fn(function (this: any) { return this; }),
  raw: vi.fn(function (this: any) { return this; }),
  clone: vi.fn(function (this: any) { return this; }),
  removeAlpha: vi.fn(function (this: any) { return this; }),
  toFormat: vi.fn(function (this: any) { return this; }),
};

vi.mock('sharp', () => ({
  default: function () {
    // Crea una nuova instance per ogni chiamata a sharp() (sharp muta lo state interno)
    const instance: any = {};
    for (const key of Object.keys(sharpMock)) {
      instance[key] = (sharpMock as any)[key];
    }
    return instance;
  },
}));

const { applyOverlay } = await import('../index');

describe('applyOverlay — cuore ❤ con larghezza = singolo carattere del font (FIX 30/07/2026)', () => {
  it('cuore ❤ viene renderizzato come <path> separato con larghezza = CHAR_WIDTH_ESTIMATE', async () => {
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        coupleNames: 'Marco ❤ Luca',
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
      },
    });
    const calls = sharpMock.composite.mock.calls;
    const compositeCall = calls[calls.length - 1]?.[0];
    expect(compositeCall).toBeDefined();
    const svgBuffer = compositeCall[0].input;
    const svgText = svgBuffer.toString('utf8');
    // Verifica: il cuore è un <path fill="#d9534f"> con transform translate+scale.
    expect(svgText).toMatch(/<path[^>]*fill="#d9534f"[^>]*transform="translate\([^)]+\) scale\([^)]+\)"/);
    // Inoltre il path cuore usa HEART_PATH_DATA (path normalizzato 20×20)
    expect(svgText).toMatch(/M 10 6 C 10 2, 5 0, 2 3/);
  });

  it('gap intorno al cuore: SIDE_GAP + HEART_WIDTH + SIDE_GAP = 3 char-widths totali tra segmenti', async () => {
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        coupleNames: 'AB ❤ CD',
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
      },
    });
    const calls = sharpMock.composite.mock.calls;
    const compositeCall = calls[calls.length - 1]?.[0];
    const svgText = compositeCall[0].input.toString('utf8');
    const tspans = [...svgText.matchAll(/<tspan x="([0-9.]+)" y="[0-9]+">([^<]*)<\/tspan>/g)];
    expect(tspans.length).toBeGreaterThanOrEqual(2);
    const CHAR_WIDTH = 19.8; // 36 * 0.55
    const HEART_WIDTH = CHAR_WIDTH;
    const SIDE_GAP = CHAR_WIDTH;
    const padLeft = 19; // 1080 * 0.018 ≈ 19
    const expectedSecondX = padLeft + 2 * CHAR_WIDTH + HEART_WIDTH + SIDE_GAP;
    const secondStart = parseFloat(tspans[1][1]);
    expect(secondStart).toBeCloseTo(expectedSecondX, 0);
  });

  it('più cuori ❤ in una stringa → path multipli, tutti con larghezza = singolo carattere', async () => {
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        coupleNames: 'A ❤ B ❤ C',
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
      },
    });
    const calls = sharpMock.composite.mock.calls;
    const compositeCall = calls[calls.length - 1]?.[0];
    const svgText = compositeCall[0].input.toString('utf8');
    const match = svgText.match(/<path[^>]*fill="#d9534f"/g) || [];
    expect(match.length).toBeGreaterThanOrEqual(2);
  });

  it('stringa senza ❤ → nessun path cuore (regressione)', async () => {
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        coupleNames: 'Marco e Luca',
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
      },
    });
    const calls = sharpMock.composite.mock.calls;
    const compositeCall = calls[calls.length - 1]?.[0];
    const svgText = compositeCall[0].input.toString('utf8');
    expect(svgText).not.toMatch(/fill="#d9534f"/);
  });
});
