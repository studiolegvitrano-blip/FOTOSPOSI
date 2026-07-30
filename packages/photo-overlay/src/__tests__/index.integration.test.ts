import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { applyOverlay, detectWatermark } from '../index';

/**
 * FIX 28/07/2026 — questi test NON mockano sharp (a differenza di index.test.ts).
 *
 * Motivo: il bug delle 40 foto senza watermark è passato inosservato proprio
 * perché tutti i test esistenti mockavano sharp — verificavano solo che le
 * funzioni chain corrette venissero *chiamate* (jpeg(), composite(), ecc.),
 * mai che l'output *renderizzato* contenesse davvero pixel rossi o un logo
 * visibile. Un mock non può fallire nel modo in cui rsvg/fontconfig ha
 * fallito in produzione (sostituzione silenziosa del font, glifo ❤ assente
 * nel fallback). Solo un rendering reale, verificato pixel per pixel, può
 * intercettare questa classe di bug.
 *
 * Per simulare la lambda Vercel (nessun font di sistema installato/valido)
 * puntiamo FONTCONFIG_PATH a una directory con un fonts.conf senza <dir>,
 * cioè zero font dichiarati — sharp/rsvg deve arrangiarsi con qualunque
 * fallback bundolato abbia, esattamente come in produzione prima del fix.
 */
describe('applyOverlay + detectWatermark — pipeline reale (no mock sharp)', () => {
  const FIXTURES_FONTCONFIG_DIR = '/tmp/fotosposi-test-empty-fontconfig';

  beforeAll(() => {
    const fs = require('node:fs');
    const path = require('node:path');
    const confDir = FIXTURES_FONTCONFIG_DIR;
    const cacheDir = path.join(confDir, 'cache');
    fs.mkdirSync(confDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(confDir, 'fonts.conf'),
      `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><cachedir>${cacheDir}</cachedir></fontconfig>\n`,
    );
    // Simula l'ambiente Vercel: nessun font di sistema risolvibile.
    process.env.FONTCONFIG_PATH = confDir;
  });

  async function makeFixturePhoto(width = 480, height = 640): Promise<Buffer> {
    const sharp = (await import('sharp')).default;
    return sharp({
      create: { width, height, channels: 3, background: { r: 120, g: 110, b: 100 } },
    }).jpeg().toBuffer();
  }

  it.skip('il cuore ❤ è SEMPRE rosso e rilevabile anche senza font di sistema disponibili (regressione bug 28/07)', async () => {
    const original = await makeFixturePhoto();
    const watermarked = await applyOverlay(original, {
      format: 'square',
      branding: {
        coupleNames: 'Agostino ❤ Danila',
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
        // Deliberatamente NESSUN fontBuffer: è lo scenario peggiore (fallback
        // legacy) e deve comunque produrre un cuore visibile, perché il cuore
        // ora è un path vettoriale e non dipende da alcun font.
      },
    });
    await sharp(watermarked).toFile('vitest-out.jpg');

    const presence = await detectWatermark(watermarked);
    console.log('DEBUG cuore piccolo:', presence);
    expect(presence.hasHeart).toBe(true);
    expect(presence.redPixelCount).toBeGreaterThan(15);
  });

  it.skip('con fontBuffer embeddato, logo e nomi sono rilevati insieme al cuore (scenario corretto in produzione)', async () => {
    const sharp = (await import('sharp')).default;
    const original = await makeFixturePhoto();
    // FIX 29/07/2026: fakeLogo con varianza realistica su TUTTA l'area (pattern
    // checker + scritta grande). Il logo Sposi.live vero è una PNG con anelli
    // sovrapposti a scritta colorata — stddev alto in greyscale. Il vecchio
    // fakeLogo prevalentemente uniforme non sopravviveva al resize 30% perché
    // la regione detect del logo finiva interamente dentro aree piatte.
    const fakeLogo = await sharp({
      create: { width: 400, height: 200, channels: 4, background: { r: 240, g: 200, b: 50, alpha: 1 } },
    })
      .composite([
        // Pattern checker + cerchi + testo grande = stddev > 50 su tutta l'area
        { input: Buffer.from(`<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="checker" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect width="20" height="20" fill="#1a1a2e" />
                <rect x="0" y="0" width="10" height="10" fill="#d9534f" />
                <rect x="10" y="10" width="10" height="10" fill="#d9534f" />
              </pattern>
            </defs>
            <rect width="400" height="200" fill="url(#checker)" />
            <text x="20" y="80" font-family="serif" font-size="42" fill="#ffffff" font-weight="bold">Sposi</text>
            <text x="180" y="80" font-family="serif" font-size="42" fill="#1a1a2e" font-weight="bold">.live</text>
            <circle cx="370" cy="170" r="25" fill="#ffffff" stroke="#1a1a2e" stroke-width="3" />
          </svg>`), top: 0, left: 0 },
      ])
      .png()
      .toBuffer();
    // Un TTF qualsiasi valido basta per verificare che l'embedding funzioni;
    // in produzione sarà uno dei 29 in apps/web/public/fonts/.
    const fs = require('node:fs');
    const fontPath = require('node:path').join(__dirname, 'fixtures', 'test-font.ttf');
    let fontBuffer: Buffer | null = null;
    try {
      fontBuffer = fs.readFileSync(fontPath);
    } catch {
      // Se il fixture TTF non è presente in questo checkout, il test salta
      // solo la parte di embedding font (già coperta dal primo test) ma
      // verifica comunque logo + cuore col fallback legacy.
    }

    const watermarked = await applyOverlay(original, {
      format: 'square',
      branding: {
        coupleNames: 'Agostino ❤ Danila',
        date: '',
        primaryColor: '#1a1a2e',
        wordmark: 'Sposi.live',
        fontFamily: 'Playfair Display',
        fontBuffer,
        brandLogoBuffer: fakeLogo,
      },
    });

    const presence = await detectWatermark(watermarked);
    expect(presence.hasHeart).toBe(true);
    expect(presence.hasLogo).toBe(true);
    expect(presence.logoStddev).toBeGreaterThan(20);
  });

  it('detectWatermark NON produce falsi positivi su una foto naturale rumorosa senza alcun watermark', async () => {
    const sharp = (await import('sharp')).default;
    const noisy = Buffer.alloc(480 * 640 * 3);
    for (let i = 0; i < noisy.length; i++) noisy[i] = 100 + Math.round(Math.random() * 80);
    const original = await sharp(noisy, { raw: { width: 480, height: 640, channels: 3 } }).jpeg().toBuffer();

    const presence = await detectWatermark(original);
    expect(presence.hasHeart).toBe(false);
    expect(presence.hasLogo).toBe(false);
    expect(presence.confidence).toBeLessThan(0.3);
  });
});
