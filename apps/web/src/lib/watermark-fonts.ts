/**
 * Mappa la scelta degli sposi (events.watermark_font) sulla famiglia CSS reale.
 * 27 font totali: 12 eleganti (corsivi/manoscritti) + 15 classici (serif).
 * I nomi chiave qui sotto sono identici ai `value` del menu in
 * apps/web/src/app/events/[id]/settings/page.tsx — se aggiungi/rimuovi un font
 * lì, aggiornalo anche qui.
 * Default: 'classico' (Playfair Display).
 *
 * Questo file NON deve importare `node:fs` o `node:path`: viene consumato anche
 * da componenti client ('use client') e Webpack non sa gestire gli import
 * `node:*` nel bundle browser → userebbe voci server in
 * `watermark-fonts.server.ts`.
 */
export function watermarkFontFamily(font?: string | null): string {
  // 12 ELEGANTI (corsivi/manoscritti)
  switch (font) {
    case 'elegante':       return 'Dancing Script';
    case 'allura':         return 'Allura';
    case 'tangerine':      return 'Tangerine';
    case 'pinyon':         return 'Pinyon Script';
    case 'great_vibes':    return 'Great Vibes';
    case 'satisfy':        return 'Satisfy';
    case 'sacramento':     return 'Sacramento';
    case 'parisienne':     return 'Parisienne';
    case 'mr_dafoe':       return 'Mr Dafoe';
    case 'sofia':          return 'Sofia';
    case 'norican':        return 'Norican';
    case 'yellowtail':     return 'Yellowtail';
    // 15 CLASSICI (serif/sans classic)
    case 'classico':       return 'Playfair Display';
    case 'moderno':        return 'Noto Sans';
    case 'cormorant':      return 'Cormorant Garamond';
    case 'bodoni':         return 'Bodoni Moda';
    case 'eb_garamond':    return 'EB Garamond';
    case 'cormorant_2':    return 'Cormorant';
    case 'baskerville':    return 'Libre Baskerville';
    case 'caslon':         return 'Libre Caslon Text';
    case 'lora':           return 'Lora';
    case 'cardo':          return 'Cardo';
    case 'roboto_slab':    return 'Roboto Slab';
    case 'source_serif':   return 'Source Serif Pro';
    case 'crimson':        return 'Crimson Text';
    case 'spectral':       return 'Spectral';
    case 'cormorant_inf':  return 'Cormorant Infant';
    default:               return 'Playfair Display';
  }
}

/**
 * Elenco strutturato dei 27 font per uso nel menu impostazioni e nelle anteprime.
 * `googleImport` è usato per il <link> Google Fonts lato browser.
 */
export const WATERMARK_FONTS: {
  value: string;
  label: string;
  family: string;
  category: 'elegante' | 'classico';
  googleImport: string;
}[] = [
  // ── 12 ELEGANTI ─────────────────────────────────────
  { value: 'elegante',      label: 'Elegante',         family: '"Dancing Script"',     category: 'elegante', googleImport: 'Dancing+Script:wght@700' },
  { value: 'allura',        label: 'Allura',            family: 'Allura',                category: 'elegante', googleImport: 'Allura' },
  { value: 'tangerine',     label: 'Tangerine',         family: 'Tangerine',             category: 'elegante', googleImport: 'Tangerine:wght@700' },
  { value: 'pinyon',        label: 'Pinyon Script',     family: '"Pinyon Script"',       category: 'elegante', googleImport: 'Pinyon+Script' },
  { value: 'great_vibes',   label: 'Great Vibes',       family: '"Great Vibes"',         category: 'elegante', googleImport: 'Great+Vibes' },
  { value: 'satisfy',        label: 'Satisfy',           family: 'Satisfy',                category: 'elegante', googleImport: 'Satisfy' },
  { value: 'sacramento',    label: 'Sacramento',         family: 'Sacramento',             category: 'elegante', googleImport: 'Sacramento' },
  { value: 'parisienne',    label: 'Parisienne',         family: 'Parisienne',             category: 'elegante', googleImport: 'Parisienne' },
  { value: 'mr_dafoe',      label: 'Mr Dafoe',           family: '"Mr Dafoe"',             category: 'elegante', googleImport: 'Mr+Dafoe' },
  { value: 'sofia',          label: 'Sofia',             family: 'Sofia',                  category: 'elegante', googleImport: 'Sofia' },
  { value: 'norican',       label: 'Norican',            family: 'Norican',                category: 'elegante', googleImport: 'Norican' },
  { value: 'yellowtail',    label: 'Yellowtail',         family: 'Yellowtail',              category: 'elegante', googleImport: 'Yellowtail' },
  // ── 15 CLASSICI ─────────────────────────────────────
  { value: 'classico',      label: 'Classico (Playfair)', family: '"Playfair Display"',  category: 'classico', googleImport: 'Playfair+Display:wght@700' },
  { value: 'moderno',       label: 'Moderno (Noto Sans)', family: '"Noto Sans"',          category: 'classico', googleImport: 'Noto+Sans:wght@700' },
  { value: 'cormorant',     label: 'Cormorant Garamond', family: '"Cormorant Garamond"',  category: 'classico', googleImport: 'Cormorant+Garamond:wght@700' },
  { value: 'bodoni',        label: 'Bodoni Moda',        family: '"Bodoni Moda"',          category: 'classico', googleImport: 'Bodoni+Moda:wght@700' },
  { value: 'eb_garamond',   label: 'EB Garamond',        family: '"EB Garamond"',          category: 'classico', googleImport: 'EB+Garamond:wght@700' },
  { value: 'cormorant_2',   label: 'Cormorant',          family: 'Cormorant',              category: 'classico', googleImport: 'Cormorant:wght@700' },
  { value: 'baskerville',   label: 'Libre Baskerville',  family: '"Libre Baskerville"',    category: 'classico', googleImport: 'Libre+Baskerville:wght@700' },
  { value: 'caslon',        label: 'Libre Caslon',        family: '"Libre Caslon Text"',    category: 'classico', googleImport: 'Libre+Caslon+Text:wght@700' },
  { value: 'lora',          label: 'Lora',                family: 'Lora',                   category: 'classico', googleImport: 'Lora:wght@700' },
  { value: 'cardo',         label: 'Cardo',              family: 'Cardo',                  category: 'classico', googleImport: 'Cardo:wght@700' },
  { value: 'roboto_slab',   label: 'Roboto Slab',        family: '"Roboto Slab"',          category: 'classico', googleImport: 'Roboto+Slab:wght@700' },
  { value: 'source_serif',  label: 'Source Serif',       family: '"Source Serif Pro"',     category: 'classico', googleImport: 'Source+Serif+Pro:wght@700' },
  { value: 'crimson',       label: 'Crimson Text',       family: '"Crimson Text"',         category: 'classico', googleImport: 'Crimson+Text:wght@700' },
  { value: 'spectral',      label: 'Spectral',           family: 'Spectral',               category: 'classico', googleImport: 'Spectral:wght@700' },
  { value: 'cormorant_inf', label: 'Cormorant Infant',   family: '"Cormorant Infant"',     category: 'classico', googleImport: 'Cormorant+Infant:wght@700' },
];


