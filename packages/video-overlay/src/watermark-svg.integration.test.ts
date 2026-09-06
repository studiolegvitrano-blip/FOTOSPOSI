// packages/video-overlay/src/escametest.integration.test.ts
// Regressione: il watermark video locale DEVE produrre un SVG XML valido anche
// quando il testo della coppia contiene caratteri speciali (&, <, >, ").
//
// Bug 05/09/2026: `escapeXml` era stato reso un no-op (replace di `&` con `&`
// letterale). Con "Elisa & Nausica" l'SVG conteneva un `&Nausica` non escapato
// → XML invalido → sharp/librsvg: "Opening and ending tag mismatch: svg ...".
// Questo test riproduce ESATTAMENTE la costruzione dell'SVG in applyVideoOverlay
// e verifica che sharp lo renderizzi senza errori XML.

import { describe, it, expect, beforeAll } from 'vitest';
import { escapeXml } from './index';

const TARGET_WIDTH = 720;

// Costruisce l'SVG esattamente come applyVideoOverlay, usando l'escapeXml REALE
// del modulo (è la funzione che era diventata un no-op: change qui → test fail).

function buildWatermarkSvg(coupleText: string, fontBase64: string | undefined): string {
  const stripH = Math.round(TARGET_WIDTH * 0.13);
  const basePx = Math.min(48, Math.max(20, Math.round(TARGET_WIDTH * 0.04)));
  const textPx = Math.round(basePx * 1.75);
  const padBottom = Math.round(stripH * 0.08);
  const padLeft = Math.round(TARGET_WIDTH * 0.02);
  const baselineY = stripH - padBottom;
  const requestedFamily = 'Georgia, serif';
  const hasFontBase64 = !!fontBase64;
  const resolvedFontFamily = hasFontBase64
    ? `'WatermarkEmbeddedFont', ${escapeXml(requestedFamily)}`
    : escapeXml(requestedFamily);
  const fontFaceDefs = hasFontBase64
    ? `<defs><style>@font-face { font-family: 'WatermarkEmbeddedFont'; src: url(data:font/ttf;base64,${fontBase64}) format('truetype'); }</style></defs>`
    : '';

  const svgParts: string[] = [
    `<text x="${padLeft.toFixed(1)}" y="${baselineY}" font-family="${resolvedFontFamily}" font-size="${textPx}" fill="#ffffff" fill-opacity="0.5" font-weight="500">${escapeXml(coupleText)}</text>`,
  ];

  return `<svg width="${TARGET_WIDTH}" height="${stripH}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    ${fontFaceDefs}
    ${svgParts.join('\n      ')}
  </svg>`;
}

let sharp: typeof import('sharp');

beforeAll(async () => {
  sharp = (await import('sharp')).default;
});

describe('video-overlay watermark SVG XML validity', () => {
  it('renderizza senza errori XML con testo contenente "&"', async () => {
    const svg = buildWatermarkSvg('Elisa & Nausica', undefined);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    expect(png.length).toBeGreaterThan(0);
  });

  it('renderizza senza errori XML con ampersand, "<", ">" e virgolette', async () => {
    const svg = buildWatermarkSvg('A & B <tag> "q"', undefined);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    expect(png.length).toBeGreaterThan(0);
  });

  it('renderizza senza errori XML con @font-face base64 embeddato', async () => {
    const fontB64 = Buffer.from(
      'dGVzdCBmb250IGJpbmFyeSBjb250ZW50' + 'A'.repeat(1000),
    ).toString('base64');
    const svg = buildWatermarkSvg('Elisa & Nausica', fontB64);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    expect(png.length).toBeGreaterThan(0);
  });
});