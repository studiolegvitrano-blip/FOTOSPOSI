import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Le lambda Vercel non hanno NESSUN font di sistema: quando sharp/librsvg rasterizza
 * gli <text> SVG del watermark, ogni glifo diventa un quadrato (tofu). Qui creiamo a
 * runtime una config fontconfig che punta al Noto Sans incluso nel repo
 * (apps/web/assets/fonts, portato nella lambda da outputFileTracingIncludes) e la
 * esponiamo via FONTCONFIG_PATH PRIMA del primo render: fontconfig sostituisce
 * automaticamente Georgia/Inter richiesti dagli SVG con l'unico font disponibile.
 * Va chiamata a livello di modulo nelle route che imprimono watermark.
 *
 * FILE SEPARATO da watermark-fonts.ts perché contiene import `node:*` che Webpack
 * non sa gestire nel bundle browser (settings/page.tsx è 'use client').
 */
export function ensureWatermarkFonts(): void {
  try {
    if (process.env.FOTOSPOSI_FONTS_READY) return;
    const fontsDir = join(process.cwd(), 'assets', 'fonts');
    const confDir = join('/tmp', 'fotosposi-fontconfig');
    const cacheDir = join('/tmp', 'fotosposi-fonts-cache');
    mkdirSync(confDir, { recursive: true });
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(confDir, 'fonts.conf'), `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>
`);
    process.env.FONTCONFIG_PATH = confDir;
    process.env.FOTOSPOSI_FONTS_READY = '1';
    console.log('[watermark-fonts] fontconfig pronto:', { fontsDir, confDir });
  } catch (e) {
    // Se /tmp non è scrivibile meglio watermark coi quadrati che far fallire l'upload.
    console.error('[watermark-fonts] setup fontconfig fallito:', e instanceof Error ? e.message : e);
  }
}

/**
 * Carica il logo PNG del brand (public/logo-*-trans.png) da comporre nel watermark
 * come overlay in alto a destra con opacità 60%.
 * Ritorna un Buffer PNG ridimensionato/opacizzato al 60%, pronto per essere composto.
 * Se la dipendenza sharp non è installessata (in lambda minima), ritorna il PNG originale
 * — l'opacità 60% sarà gestita dal composita di sharp in applyOverlay.
 * Se il file non è disponibile, ritorna null (resta solo il wordmark testuale in banda).
 */
export function loadBrandLogo(brand?: string | null): Buffer | null {
  try {
    const file = brand === 'weddingmoments' ? 'logo-justmarry-trans.png' : 'logo-sposi-trans.png';
    return readFileSync(join(process.cwd(), 'public', file));
  } catch {
    return null;
  }
}
