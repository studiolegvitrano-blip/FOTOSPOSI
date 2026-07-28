import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WATERMARK_FONTS } from './watermark-fonts';

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
 * FIX 28/07/2026: carica i bytes del TTF corrispondente alla scelta font degli
 * sposi (events.watermark_font → WATERMARK_FONTS[].ttfFile), da passare come
 * `branding.fontBuffer` ad applyOverlay. Il chiamante (process-queue.ts) lo
 * embedda nell'SVG via @font-face invece di affidarsi al font-family testuale
 * risolto da fontconfig — che nelle lambda Vercel silenziosamente sostituisce
 * il font richiesto senza lanciare errore (vedi ensureWatermarkFonts sopra).
 *
 * Cerca in apps/web/public/fonts/<ttfFile> (bundle da assicurare in
 * next.config.ts → outputFileTracingIncludes, INSIEME a assets/fonts/** e
 * public/logo-*.png già presenti — mancava prima di questo fix).
 *
 * Ritorna null (mai lancia) se il font scelto non ha un ttfFile risolvibile
 * su disco (font solo Google Fonts non scaricato, file mancante, ecc.):
 * in quel caso applyOverlay torna al comportamento legacy (font-family
 * testuale) — degradato ma non bloccante.
 */
export function loadWatermarkFontBuffer(fontKey?: string | null): Buffer | null {
  const entry = WATERMARK_FONTS.find((f) => f.value === fontKey) ?? WATERMARK_FONTS[0];
  if (!entry?.ttfFile) return null;
  try {
    return readFileSync(join(process.cwd(), 'public', 'fonts', entry.ttfFile));
  } catch (e) {
    console.error(
      `[watermark-fonts] impossibile leggere il TTF '${entry.ttfFile}' (font='${fontKey}'):`,
      e instanceof Error ? e.message : e,
    );
    return null;
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
  const file = brand === 'weddingmoments' ? 'logo-justmarry-trans.png' : 'logo-sposi-trans.png';
  try {
    return readFileSync(join(process.cwd(), 'public', file));
  } catch (e) {
    // FIX 28/07/2026: prima questo catch era silenzioso — se public/<file> non
    // era raggiungibile nella lambda (path sbagliato, file non bundlato), il
    // logo brand spariva senza nessuna traccia nei log. Sospettato essere
    // parte della causa del bug "logo assente, stddev 4.14" sull'evento
    // ee2cc954-98d7-4e11-828b-668a52e738e2.
    console.error(`[watermark-fonts] logo brand '${file}' non trovato in public/:`, e instanceof Error ? e.message : e);
    return null;
  }
}
