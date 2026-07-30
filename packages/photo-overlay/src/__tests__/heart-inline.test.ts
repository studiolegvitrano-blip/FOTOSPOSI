import { describe, it, expect, vi } from 'vitest';

// FIX 30/07/2026 (v3) — cuore reso come <path> SVG vettoriale separato,
// posizionato con misure ASSOLUTE (px) calcolate dal cursorX del <text>.
// Il <text> contiene SOLO i segmenti di testo (no cuore), il <path> cuore
// è renderizzato separatamente alla X giusta. Test integration su sharp
// REALE ha confermato che le entity XML `&#10084;` non vengono rese (hasHeart
// = false → cuore invisibile), quindi serve il path per garantire il rosso.
//
// Strategia chiave:
//   - Il <text> ha SOLO i segmenti di testo separati (no cuore dentro).
//   - Il <path> cuore è posizionato a `cursorX + HEART_WIDTH/2`, dove
//     cursorX è la X di fine del segmento di testo precedente.
//   - path è su griglia 20×20, scalato a actualTextPx per essere alto
//     quanto un carattere del font.
//
// Test points:
//   - Il cuore è un <path fill="#d9534f"> con transform translate+scale
//   - Il <text> contiene SOLO i segmenti di testo, NON il cuore
//   - L'emoji ❤️ (U+2764 + U+FE0F) viene splittata correttamente
//   - Il testo è +75% più grande della base
//   - Il monogramma NON esce dal bordo destro (auto-fit)

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
    const instance: any = {};
    for (const key of Object.keys(sharpMock)) {
      instance[key] = (sharpMock as any)[key];
    }
    return instance;
  },
}));

const { applyOverlay } = await import('../index');

describe('applyOverlay — cuore come <image href="data:image/png;base64,..."> (FIX 30/07 v4)', () => {
  it('cuore ❤ reso come <image href="data:image/png;base64,..."> inline', async () => {
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
    const svgText = compositeCall[0].input.toString('utf8');
    // FIX 30/07 v4: cuore è ora un <image href="data:image/png;base64,..."> (PNG rosso inline)
    // con preserveAspectRatio="none" per riempire lo slot quadrato.
    expect(svgText).toMatch(/<image[^>]*href="data:image\/png;base64,[^"]+"/);
    expect(svgText).toContain('preserveAspectRatio="none"');
  });

  it('<text> contiene SOLO i segmenti di testo, NON il cuore', async () => {
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
    const svgText = compositeCall[0].input.toString('utf8');
    // FIX 30/07 v4: il cuore è un <image> PNG separato, non dentro <text>.
    // Nessuna entity XML cuore dentro il <text>.
    expect(svgText).not.toMatch(/&#10084;/);
    // Nessun tspan cuore (l'emoji composto non viene reso da librsvg).
    expect(svgText).not.toMatch(/<tspan[^>]*fill="#d9534f"/);
  });

  it('emoji cuore composto ❤️ = ❤ (U+2764) + VS16 (U+FE0F) → split OK in 2 segmenti', async () => {
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        coupleNames: 'Agostino❤️Danila', // U+2764 U+FE0F
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
      },
    });
    const calls = sharpMock.composite.mock.calls;
    const compositeCall = calls[calls.length - 1]?.[0];
    const svgText = compositeCall[0].input.toString('utf8');
    // FIX 30/07 v4: il cuore è ora un <image href="data:image/png;base64,...">.
    // Deve esserci esattamente 1 <image> cuore (split corretto in 2 segmenti).
    const matches = svgText.match(/<image[^>]*href="data:image\/png;base64,/g) || [];
    expect(matches.length).toBe(1);
    // Agostino e Danila devono essere entrambi presenti nei <text>.
    const textEls = [...svgText.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];
    const allText = textEls.map((m) => m[1]).join('|');
    expect(allText).toContain('Agostino');
    expect(allText).toContain('Danila');
  });

  it('testo +75% rispetto alla base: textPx × 1.75 (richiesta utente 30/07)', async () => {
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        coupleNames: 'Agostino ❤ Danila',
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
      },
    });
    const calls = sharpMock.composite.mock.calls;
    const compositeCall = calls[calls.length - 1]?.[0];
    const svgText = compositeCall[0].input.toString('utf8');
    const fontSizeMatch = svgText.match(/font-size="(\d+)"/);
    expect(fontSizeMatch).not.toBeNull();
    const fontSize = parseInt(fontSizeMatch![1]);
    expect(fontSize).toBe(63); // 36 * 1.75 = 63
  });

  it('testo lungo → auto-fit (non esce dal bordo destro)', async () => {
    await applyOverlay(Buffer.from('test'), {
      format: 'square',
      branding: {
        coupleNames: 'Testo molto lungo che eccede sicuramente la larghezza della foto in 1080px xxxxxx',
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
      },
    });
    const calls = sharpMock.composite.mock.calls;
    const compositeCall = calls[calls.length - 1]?.[0];
    const svgText = compositeCall[0].input.toString('utf8');
    // L'auto-fit deve aver ridotto font-size rispetto al base 63 (deve essere < 63).
    const fontSizeMatch = svgText.match(/font-size="(\d+)"/);
    const fontSize = parseInt(fontSizeMatch![1]);
    expect(fontSize).toBeLessThan(63);
    expect(fontSize).toBeGreaterThanOrEqual(12);
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

  it('più cuori ❤ → più path separati (tutti con larghezza = singolo carattere)', async () => {
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
    // FIX 30/07 v4: cuore è ora un <image href="data:image/png;base64,..."> (PNG rosso inline)
    // invece di <path fill="#d9534f" transform=...>. Verifichiamo che ci siano 2 <image> cuore.
    const match = svgText.match(/<image[^>]*href="data:image\/png;base64,/g) || [];
    expect(match.length).toBe(2);
  });
});
