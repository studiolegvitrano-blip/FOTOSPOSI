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
  raw: vi.fn(() => chain),
  clone: vi.fn(() => chain), // 28/07/2026: detectWatermark usa .clone() dopo extract
  removeAlpha: vi.fn(() => chain), // 28/07/2026: detectWatermark usa removeAlpha() per RGB raw
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

  it('cuore ❤ è renderizzato come path SVG vettoriale rossso (no entità XML glifo)', async () => {
    // 28/07/2026: il glifo Unicode ❤ (U+2764) sparisce quando fontconfig di sistema
    // non risolve il font richiesto → cuoricini (path vettoriali) invece di testo.
    chain.toBuffer = vi.fn().mockResolvedValue(Buffer.from('emoji'));
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: { ...baseBranding, coupleNames: 'Guido ❤ Melissa', date: '25/08/2026', wordmark: 'Sposi.live' },
    });
    expect(chain.composite).toHaveBeenCalled();
    const call = chain.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    const svgText = call[0].input.toString('utf8');
    expect(svgText).toContain('fill="#d9534f"'); // cuore rosso
    expect(svgText).toContain('<path'); // path vettoriale (non più entità &#10084;)
    expect(svgText).toContain('Guido');
    expect(svgText).toContain('Melissa');
  });

  it('watermark SOLO nomi (28/07 fix): un solo path del cuore rosso, no data/wordmark', async () => {
    chain.toBuffer = vi.fn().mockResolvedValue(Buffer.from('only-names'));
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      // Il caller passa già la stringa formattata "Nome1 ❤ Nome2"
      branding: { coupleNames: 'Marco ❤ Luca', primaryColor: '#1a1a2e', wordmark: 'Sposi.live' },
    });
    const call = chain.composite.mock.calls[0][0] as Array<{ input: Buffer }>;
    const svgText = call[0].input.toString('utf8');
    expect(svgText).toContain('Marco');
    expect(svgText).toContain('Luca');
    expect(svgText).toContain('fill="#d9534f"'); // cuore rosso
    expect(svgText).toContain('<path'); // path vettoriale
    // Più di un path del cuore (es. data nel watermark) sarebbe un bug
    const pathCount = (svgText.match(/<path[^>]*fill="#d9534f"/g) || []).length;
    expect(pathCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
// detectWatermark — verifica euristica presenza watermark.
// Test con bufferi simulati: uniforme (no watermark) vs varianza alta (watermark).
// ─────────────────────────────────────────────────────────────────────

const { detectWatermark } = await import('../index');

describe('detectWatermark', () => {
  // Costruisce un'immagine greyscale uniforme di dimensioni note.
  function uniformBuffer(width: number, height: number, value: number): Buffer {
    return Buffer.from(new Array(width * height).fill(value));
  }

  // Costruisce un'immagine con "segnale" nelle regioni campione del watermark:
  // top-right (logo) e bottom-left (nomi) con varianza alta, resto uniforme.
  function imageWithWatermark(imgW: number, imgH: number): Buffer {
    const buf = Buffer.alloc(imgW * imgH, 100); // sfondo medio
    const logoSize = Math.max(40, Math.round(Math.min(imgW, imgH) * 0.15));
    const logoLeft = Math.max(0, imgW - logoSize - Math.round(imgW * 0.02));
    const logoTop = Math.round(imgH * 0.02);
    for (let r = 0; r < logoSize; r++) {
      for (let c = 0; c < logoSize; c++) {
        buf[(logoTop + r) * imgW + (logoLeft + c)] = ((r + c) % 2 === 0) ? 20 : 240;
      }
    }
    const namesW = Math.max(80, Math.round(imgW * 0.35));
    const namesH = Math.max(20, Math.round(imgH * 0.05));
    const namesLeft = Math.round(imgW * 0.012);
    const namesTop = Math.max(0, imgH - namesH - Math.round(imgH * 0.012));
    for (let r = 0; r < namesH; r++) {
      for (let c = 0; c < namesW; c++) {
        const bar = Math.floor(c / 4) % 2 === 0;
        buf[(namesTop + r) * imgW + (namesLeft + c)] = bar ? 30 : 220;
      }
    }
    return buf;
  }

  // Variabile condivisa traccia l'ultimo buffer passato a sharp() e l'ultimo raw crop.
  let lastInput: Buffer = Buffer.alloc(0);
  let lastExtractedRaw: Buffer = Buffer.alloc(0);

  beforeEach(() => {
    vi.clearAllMocks();
    // sharp(buf) traccia l'input e restituisce la chain.
    mockSharp.mockImplementation((buf: Buffer) => {
      lastInput = buf;
      return chain;
    });
    // metadata interrogato da detectWatermark
    chain.metadata = vi.fn().mockResolvedValue({ width: 1080, height: 1080 });
    chain.stats = vi.fn().mockResolvedValue({ channels: [{ mean: 100 }, { mean: 100 }, { mean: 100 }] });
    // extract(region) estrae i pixel dal buffer input e pone lastExtractedRaw (32x32).
    chain.extract = vi.fn().mockImplementation(function (this: any, region: { left: number; top: number; width: number; height: number }) {
      const { left, top, width, height } = region;
      const out = Buffer.alloc(width * height);
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const srcIdx = (top + r) * 1080 + (left + c); // ipotesi imgW = 1080
          out[r * width + c] = lastInput[Math.min(srcIdx, lastInput.length - 1)] ?? 0;
        }
      }
      return chain;
    });
    // resize(w,h) decide il target raw: 32x32 per logo, 128x16 per nomi.
    chain.resize = vi.fn().mockImplementation(function (this: any, w: number, h: number) {
      // produce un buffer w*h prendendo i sample da lastInput assoluto (perché extract </chain>
      // ritorna chain ma non accumula stato che dica quale region è stato extracted).
      // Rileggiamo la region dal lastInput usando il mapping default (ignoriamo extract).
      const out = Buffer.alloc(w * h);
      // Heuristic: le resize sono chiamate dopo extract; usiamo una mappa semplice
      // crop-down → lastInput sample
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const srcR = Math.floor((r / h) * 1080);
          const srcC = Math.floor((c / w) * 1080);
          out[r * w + c] = lastInput[srcR * 1080 + srcC] ?? 0;
        }
      }
      lastExtractedRaw = out;
      return chain;
    });
    chain.greyscale = vi.fn(() => chain);
    chain.raw = vi.fn(() => chain);
    chain.clone = vi.fn(() => chain); // 28/07/2026: detectWatermark usa .clone()
    chain.removeAlpha = vi.fn(() => chain); // 28/07/2026: detectWatermark usa removeAlpha()
    chain.toBuffer = vi.fn().mockImplementation(async (opts?: any) => {
      if (opts && (opts as any).resolveWithObject) {
        return { data: lastExtractedRaw, info: { width: 32, height: 32, channels: 1 } };
      }
      return lastExtractedRaw;
    });
  });

  it('restitituisce hasLogo=false e hasNames=false su immagine uniforme (no watermark)', async () => {
    const presence = await detectWatermark(uniformBuffer(1080, 1080, 128));
    expect(presence.hasLogo).toBe(false);
    expect(presence.hasNames).toBe(false);
    expect(presence.confidence).toBeLessThan(0.3);
  });

  it('restitituisce hasLogo=true e hasNames=true su immagine con watermark simulato', async () => {
    const presence = await detectWatermark(imageWithWatermark(1080, 1080));
    expect(presence.hasLogo).toBe(true);
    expect(presence.hasNames).toBe(true);
    // NB 28/07/2026: la nuova confidence è pesata per metà sul hasHeart (pixel RGB
    // rossi), che il mock di sharp non simula realisticamente in questo test perché
    // opera su dati greyscale "fasulli" (pattern 30/220 che per combinazione matcha
    // i criteri cromatici del rosso). Quindi qui verifichiamo solo hasLogo+hasNames
    // positivi (che è ciò che il test simula realmente); la verifica end-to-end del
    // cuore reale è delegata a index.integration.test.ts (3 test, sharp reale).
    expect(presence.confidence).toBeGreaterThanOrEqual(0);
    expect(presence.confidence).toBeLessThanOrEqual(1);
  });

  it('confidenza è un valore tra 0 e 1', async () => {
    const presence = await detectWatermark(uniformBuffer(1080, 1080, 128));
    expect(presence.confidence).toBeGreaterThanOrEqual(0);
    expect(presence.confidence).toBeLessThanOrEqual(1);
  });

  it('stddev logo è 0 per immagine uniforme', async () => {
    const presence = await detectWatermark(uniformBuffer(1080, 1080, 100));
    expect(presence.logoStddev).toBe(0);
    expect(presence.namesStddev).toBe(0);
    expect(presence.namesEdgeScore).toBe(0);
  });
});
