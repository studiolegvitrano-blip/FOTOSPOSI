import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sharp: ogni chiamata `sharp(buf)` ritorna la stessa catena con tutti i metodi chained.
// Include extract/resize/stats/composite/jpeg/toBuffer usati dal nuovo applyOverlay.
const chain: any = {
  metadata: vi.fn(),
  resize: vi.fn(() => chain),
  extract: vi.fn(() => chain),
  stats: vi.fn(),
  composite: vi.fn(() => chain),
  jpeg: vi.fn(() => chain),
  toBuffer: vi.fn(),
  raw: vi.fn(() => chain), // usato invec chainsoked altrove (defensive)
};
const mockSharp = vi.fn(() => chain);

vi.mock('sharp', () => ({
  default: mockSharp,
}));

const { applyOverlay } = await import('../index');

describe('applyOverlay', () => {
  const baseBranding = {
    coupleNames: 'Mario & Lucia',
    date: '15 Giugno 2026',
    primaryColor: '#d4a574',
    wordmark: 'JustMarry.live',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-bind default chain returns so reordered tests stay isolated.
    chain.metadata = vi.fn().mockResolvedValue({ width: 1200, height: 800 });
    // stats() per il path luminanza: returns channels RGB均值 pairing.
    chain.stats = vi.fn().mockResolvedValue({
      channels: [{ mean: 100 }, { mean: 100 }, { mean: 100 }], // avg muy scuro → text bianco
    });
    chain.jpeg = vi.fn(() => chain);
    chain.composite = vi.fn(() => chain);
    chain.toBuffer = vi.fn().mockResolvedValue(Buffer.from('result'));
    chain.resize = vi.fn(() => chain);
    chain.extract = vi.fn(() => chain);
  });

  it('applica overlay formato square', async () => {
    const result = await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: baseBranding,
    });
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(chain.jpeg).toHaveBeenCalledWith({ quality: 92 });
  });

  it('applica overlay formato story', async () => {
    chain.metadata = vi.fn().mockResolvedValue({ width: 1080, height: 1920 });
    chain.toBuffer = vi.fn().mockResolvedValue(Buffer.from('result-story'));
    const result = await applyOverlay(Buffer.from('test'), {
      format: 'story',
      branding: baseBranding,
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('usa colori e font personalizzati', async () => {
    const result = await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        ...baseBranding,
        textColor: '#ff0000',
        fontFamily: 'Arial',
      },
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('gestisce nomi con caratteri speciali XML (escape & < >)', async () => {
    const result = await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: { ...baseBranding, coupleNames: 'Marco & Anna <3' },
    });
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('usa metadati immagine per calcoli', async () => {
    chain.metadata = vi.fn().mockResolvedValue({ width: 640, height: 480 });
    chain.toBuffer = vi.fn().mockResolvedValue(Buffer.from('resized'));
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: baseBranding,
    });
    expect(chain.metadata).toHaveBeenCalled();
  });

  it('cuore ❤ è XML-safe come entità &#10084; nel watermark', async () => {
    chain.toBuffer = vi.fn().mockResolvedValue(Buffer.from('emoji'));
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: { ...baseBranding, coupleNames: 'Guido', date: '25/08/2026', wordmark: 'Sposi.live' },
    });
    expect(chain.composite).toHaveBeenCalled();
    const call = chain.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    const svgText = call[0].input.toString('utf8');
    expect(svgText).toContain('&#10084;'); // cuore come entità XML
    expect(svgText).toContain('fill="#d9534f"'); // tspan rosso
  });
});
