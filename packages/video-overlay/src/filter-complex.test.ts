// packages/video-overlay/src/filter-complex.test.ts
// Regressione 12/09/2026: `buildFilterComplex` lasciara un output label
// "unconnected" quando la catena terminava con un overlay non consumato
// (nessun logo, o solo brand) → ffmpeg: "Filter overlay has an unconnected
// output". La regola è: SOLO l'ultimo overlay termina SENZA label (ffmpeg
// auto-mappa l'output al file); i passi intermedi hanno un label per concatenare.

import { describe, it, expect } from 'vitest';
import { buildFilterComplex } from './index';

describe('video-overlay buildFilterComplex', () => {
  it('senza logo: catena solo scale + overlay testo, nessun label residuo', () => {
    const f = buildFilterComplex(false, false);
    // Attesa: [0:v]scale=720:-2[base];[base][1:v]overlay=0:main_h-overlay_h
    expect(f).toBe('[0:v]scale=720:-2[base];[base][1:v]overlay=0:main_h-overlay_h');
  });

  it('solo brand: termina SENZA label (auto-map finale)', () => {
    const f = buildFilterComplex(true, false);
    expect(f.endsWith(':24')).toBe(true);
    expect(f.endsWith('[wm]')).toBe(false);
    expect(f.endsWith('[wb]')).toBe(false);
    expect(f).toContain('[wm][2:v]overlay=main_w-overlay_w-24:24');
  });

  it('brand + partner: catena concatenata con label intermedi, nessun orfano', () => {
    const f = buildFilterComplex(true, true);
    expect(f).toContain('[wm][2:v]overlay=main_w-overlay_w-24:24[wb]');
    expect(f).toContain('[wb][3:v]overlay=24:24');
    expect(f.endsWith('[wb]')).toBe(false);
    expect(f.endsWith('[wm]')).toBe(false);
  });

  it('solo partner: source è wm, index 2', () => {
    const f = buildFilterComplex(false, true);
    expect(f).toContain('[wm][2:v]overlay=24:24');
    expect(f.endsWith('[wm]')).toBe(false);
  });

  it('ogni output label è consumato da un overlay successivo (nessun unconnected)', () => {
    const cases = [
      buildFilterComplex(false, false),
      buildFilterComplex(true, false),
      buildFilterComplex(false, true),
      buildFilterComplex(true, true),
    ];
    for (const f of cases) {
      // ogni label [xyz] definito come output (label dopo overlay mã) deve essere
      // riutilizzato come input da un overlay successivo. Uso semantico semplice:
      // la catena non può TERMINARE con un label non virtuale ([wm]/[wb]).
      for (const tail of ['[wm]', '[wb]', '[wm2]']) {
        expect(f.endsWith(tail)).toBe(false);
      }
    }
  });
});