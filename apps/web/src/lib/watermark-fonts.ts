/**
 * Mappa la scelta degli sposi (events.watermark_font) sulla famiglia CSS reale,
 * coerente con i 29 TTF in apps/web/assets/fonts/ (copiati anche in public/fonts/)
 * e con il nome family interno che fontconfig vede lato server Vercel.
 *
 * 29 font totali, divisi in due categorie per il menu UI:
 *   - 18 ELEGANTI  (corsivi/manoscritti/firma)
 *   - 11 CLASSICI  (serif/sans/display)
 *
 * Default: 'classico' (Playfair Display).
 *
 * File SEPARATO da watermark-fonts.server.ts: questo NON deve importare `node:*`
 * perché viene consumato anche da componenti client ('use client') — Webpack non
 * sa gestire `node:*` nel bundle browser. Le utility server-only sono in
 * watermark-fonts.server.ts.
 */

export interface WatermarkFont {
  /** Identificatore breve persistito su events.watermark_font */
  value: string;
  /** Etichetta human-readable per il menu UI */
  label: string;
  /** Family CSS, tra doppi apici se contiene spazi */
  family: string;
  /** Categoria per raggruppamento nel menu */
  category: 'elegante' | 'classico';
  /** Query-string Google Fonts CSS2 per anteprima UI lato browser; vuoto se il
   *  font non è su Google Fonts (in tal caso usiamo il TTF locale in public/fonts/) */
  googleImport?: string;
  /** Nome del file TTF in apps/web/public/fonts/ per anteprima UI lato browser.
   *  Usato solo quando googleImport è vuoto (font non su Google Fonts). */
  ttfFile?: string;
}

export const WATERMARK_FONTS: WatermarkFont[] = [
  // ── 18 ELEGANTI (corsivi/manoscritti/firma) ──────────────────────
  // 7 disponibili anche su Google Fonts (anteprima via CSS2) + 11 solo TTF
  { value: 'classico',     label: 'Playfair (default)', family: '"Playfair Display"',  category: 'classico',  googleImport: 'Playfair+Display:wght@700',           ttfFile: 'PlayfairDisplay-Regular.ttf' },
  { value: 'dancing',      label: 'Dancing Script',     family: '"Dancing Script"',     category: 'elegante', googleImport: 'Dancing+Script:wght@700',             ttfFile: 'DancingScript-Regular.ttf' },
  { value: 'allura',       label: 'Allura',            family: 'Allura',                category: 'elegante', googleImport: 'Allura',                               ttfFile: 'Allura-Regular.ttf' },
  { value: 'great_vibes',  label: 'Great Vibes',       family: '"Great Vibes"',         category: 'elegante', googleImport: 'Great+Vibes',                          ttfFile: 'GreatVibes-Regular.ttf' },
  { value: 'pinyon',       label: 'Pinyon Script',     family: '"Pinyon Script"',      category: 'elegante', googleImport: 'Pinyon+Script',                       ttfFile: 'PinyonScript-Regular.ttf' },
  { value: 'italianno',    label: 'Italianno',         family: 'Italianno',            category: 'elegante', googleImport: 'Italianno',                           ttfFile: 'Italianno-Regular.ttf' },
  { value: 'lucida',       label: 'Lucida Calligraphy', family: '"Lucida Calligraphy"', category: 'elegante',                                                       ttfFile: 'LucidaCalligraphy.ttf' },
  { value: 'agetya',       label: 'Agetya Butterfly',  family: '"Agetya Butterfly Demo"', category: 'elegante',                                                ttfFile: 'Agetya Butterfly Demo.ttf' },
  { value: 'agetya_italic', label: 'Agetya Butterfly Italic', family: '"Agetya Butterfly Italic"', category: 'elegante',                                     ttfFile: 'Agetya Butterfly Italic Demo.ttf' },
  { value: 'angelos',      label: 'Angelos',           family: '"Angelos-Personal use"', category: 'elegante',                                                      ttfFile: 'Angelos.ttf' },
  { value: 'brittany',     label: 'Brittany Signature', family: '"Brittany Signature Script"', category: 'elegante',                                                ttfFile: 'BrittanySignatureScript.ttf' },
  { value: 'dearllane',    label: 'Dearllane',         family: 'Dearllane',            category: 'elegante',                                                       ttfFile: 'Dearllane.ttf' },
  { value: 'hugh_is_life', label: 'Hugh is Life',      family: '"Hugh is Life Personal Use"', category: 'elegante',                                                   ttfFile: 'Hugh is Life Personal Use .ttf' },
  { value: 'lucy_said_ok', label: 'Lucy Said Ok',      family: '"Lucy Said Ok Personal Use"', category: 'elegante',                                                  ttfFile: 'Lucy Said Ok Personal Use.ttf' },
  { value: 'my_sunshine',  label: 'My Sunshine',       family: '"My Sunshine"',         category: 'elegante',                                                       ttfFile: 'MySunshine.ttf' },
  { value: 'eagle_horizon', label: 'Eagle Horizon',    family: '"Eagle Horizon-Personal use"', category: 'elegante',                                                ttfFile: 'EagleHorizonP.ttf' },
  { value: 'ocean_trace',  label: 'Ocean Trace',       family: '"Ocean Trace-Personal use"', category: 'elegante',                                                    ttfFile: 'OceanTrace.ttf' },
  { value: 'bakery_wedding', label: 'Bakery Wedding', family: '"Bakery  Wedding"',    category: 'elegante',                                                       ttfFile: 'Bakery Wedding.ttf' },
  { value: 'bobbers',      label: 'Bobbers',           family: '"Bobbers Personal Use"', category: 'elegante',                                                     ttfFile: 'Bobbers Personal Use.ttf' },
  // ── 11 CLASSICI (serif/sans/display) ───────────────────────────
  { value: 'moderno',      label: 'Noto Sans (moderno)', family: '"Noto Sans"',        category: 'classico',  googleImport: 'Noto+Sans:wght@700',                   ttfFile: 'NotoSans-Regular.ttf' },
  { value: 'awesome',      label: 'Awesome',           family: 'Awesome',              category: 'classico',                                                        ttfFile: 'Awesome.ttf' },
  { value: 'baby_time',    label: 'Baby Time',         family: 'Babytime',             category: 'classico',                                                         ttfFile: 'Baby time.ttf' },
  { value: 'blackout',     label: 'Blackout Oldskull',  family: '"Blackout Oldskull"',  category: 'classico',                                                         ttfFile: 'BlackoutOldskull.ttf' },
  { value: 'himalayan',    label: 'Himalayan',          family: 'Himalayan',            category: 'classico',                                                          ttfFile: 'Himalayan.ttf' },
  { value: 'kingline',     label: 'Kingline',           family: 'Kingline',             category: 'classico',                                                         ttfFile: 'Kingline.ttf' },
  { value: 'gista_danes',  label: 'Gista Danes',        family: '"Gista Danes"',        category: 'classico',                                                         ttfFile: 'Gista Danes.ttf' },
  { value: 'ocean_delight', label: 'Ocean Delight',     family: '"Ocean Delight"',      category: 'classico',                                                          ttfFile: 'Ocean Delight.ttf' },
];

/**
 * Mappa la chiave events.watermark_font sul family CSS reale, coerente con i
 * nomi interni dei TTF in apps/web/assets/fonts/ (fontconfig lato server).
 * Default: 'Playfair Display' (chiave 'classico').
 */
export function watermarkFontFamily(font?: string | null): string {
  const entry = WATERMARK_FONTS.find((f) => f.value === font);
  return entry?.family ?? '"Playfair Display"';
}
