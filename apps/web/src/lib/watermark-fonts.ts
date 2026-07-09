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
  } catch {
    // Se /tmp non è scrivibile meglio watermark coi quadrati che far fallire l'upload.
  }
}

/**
 * Mappa la scelta degli sposi (events.watermark_font) sulla famiglia reale dei font
 * inclusi in assets/fonts. Default: 'classico'.
 */
export function watermarkFontFamily(font?: string | null): string {
  switch (font) {
    case 'elegante': return 'Dancing Script';
    case 'moderno': return 'Noto Sans';
    case 'classico':
    default: return 'Playfair Display';
  }
}

/**
 * Carica il logo PNG del brand (public/logo-*-trans.png) da comporre nel watermark.
 * Ritorna null se il file non è nella lambda (le route devono includerlo via
 * outputFileTracingIncludes) — in quel caso resta il wordmark testuale.
 */
export function loadBrandLogo(brand?: string | null): Buffer | null {
  try {
    const file = brand === 'weddingmoments' ? 'logo-justmarry-trans.png' : 'logo-sposi-trans.png';
    return readFileSync(join(process.cwd(), 'public', file));
  } catch {
    return null;
  }
}
