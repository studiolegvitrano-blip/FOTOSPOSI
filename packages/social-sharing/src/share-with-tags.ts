/**
 * Share-with-tags — costruzione testo + URL di condivisione social con tag
 * automatici (@handle sposi + @sposilive/@justmarry + hashtag).
 *
 * Regole di business (richiesta cliente 10/08/2026):
 * - La PRIMA riga del testo è SCRITTA DALL'UTENTE (frase personale)
 * - Dopo almeno 8 spazi (o newline) vengono i tag OBBLIGATORI:
 *     @sposa1 @sposa2 @sposilive  (+ @partner se B2B)
 *     #sposilive #hashtagcoppia    (+ #hashtagpartner se B2B)
 * - Funziona per tutti i tier (free incluso): solo URL web share, no API
 *   a pagamento, no OAuth complesso.
 * - Per Instagram: NON fattibile via URL share (policy anti-spam). Il
 *   client copierà il testo negli appunti e aprirà l'app IG manualmente.
 *
 * Normalizzazione handle:
 * - Handle salvato nel DB con o senza '@' → normalizziamo sempre a '@xxx'
 * - Hashtag salvato con o senza '#' → normalizziamo sempre a '#xxx'
 * - Handle vuoto/null → omesso (non inseriamo @null)
 */

export type SharePlatform = 'facebook' | 'tiktok' | 'twitter' | 'instagram';
export type BrandHandle = 'sposilive' | 'justmarry';

export interface ShareTagInput {
  /** Testo libero scritto dall'utente (prima riga). */
  userText: string;
  /** Handle sposo 1 (es. 'lillo' o '@lillo'). NULL/empty → omesso. */
  groom1Handle?: string | null;
  /** Handle sposo 2 (es. 'mariaesposito' o '@mariaesposito'). */
  groom2Handle?: string | null;
  /** Hashtag coppia (es. 'matri2026' o '#matri2026'). */
  coupleHashtag?: string | null;
  /** Handle partner B2B (es. 'sartoriaitalianaofficial'). */
  partnerHandle?: string | null;
  /** Hashtag partner B2B (es. 'sartoriaitalianaofficial'). */
  partnerHashtag?: string | null;
  /** URL pubblica della foto (usato SOLO da buildShareUrl per i link sharer; il TESTO non lo contiene mai). */
  photoUrl?: string;
  /** Brand: 'sposilive' (IT) o 'justmarry' (INT) → determina @brandHardcoded. */
  brand?: BrandHandle;
}

/** Handle brand hard-coded (mai nel DB, costante di brand). */
const BRAND_HANDLE: Record<BrandHandle, string> = {
  sposilive: '@sposilive',
  justmarry: '@justmarry.live',
};
const BRAND_HASHTAG: Record<BrandHandle, string> = {
  sposilive: '#sposilive',
  justmarry: '#justmarry',
};

/** Hashtag generici di wedding (dopo brand + coppia + partner). Richiesta cliente 22/09/2026. */
const BRAND_GENERIC_HASHTAGS: Record<BrandHandle, string[]> = {
  sposilive: ['#Matrimonio', '#Nozze', '#Wedding'],
  justmarry: ['#Wedding', '#WeddingItaly'],
};

/** Normalizza un handle: trim + prepend '@' se mancante. '' se vuoto. */
function normalizeHandle(h?: string | null): string | null {
  if (!h) return null;
  const v = h.trim();
  if (!v) return null;
  return v.startsWith('@') ? v : `@${v}`;
}

/**
 * Normalizza un hashtag per i social: trim, strip '#' iniziali, diacritici rimossi
 * (NFD — gli hashtag non funzionano con accenti), SOLO [a-zA-Z0-9_] (&, spazi,
 * punteggiatura strippati — '&' rompe l'hashtag sui social). Ritorna '#xxx' o ''.
 */
function normalizeHashtag(h?: string | null): string | null {
  if (!h) return null;
  const clean = h
    .trim()
    .replace(/^#+/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '');
  return clean ? `#${clean}` : null;
}

/**
 * Converte il nome della coppia (es. "Elisa & Nausica") in un hashtag valido
 * (es. "#ElisaNausica"). Rimuove spazi e caratteri non ammessi negli hashtag
 * (Instagram/TikTok accettano solo lettere, numeri, underscore). Se il campo è
 * vuoto o necostruisce una stringa vuota → null (omesso).
 */
export function coupleNameToHashtag(coupleName?: string | null): string | null {
  if (!coupleName) return null;
  const cleaned = coupleName
    .replace(/\s*&\s*/gi, 'E') // "Elisa & Marco" → "ElisaEMarco" (& non è valido negli hashtag)
    .replace(/[^a-zA-Z0-9_\p{L}\p{N}]/gu, '')
    .replace(/^#+/, '');
  if (!cleaned) return null;
  return `#${cleaned}`;
}

/**
 * Costruisce il testo da condividere nel formato richiesto:
 *
 *   <frase utente>
 *          @lillo @mariaesposito @sposilive @sartoriaitalianaofficial
 *          #sposilive #matri2026 #sartoriaitalianaofficial
 *
 * - Prima riga: testo utente (se vuoto, si parte con newline)
 * - Seconda riga: 8 spazi + handles (@)
 * - Terza riga: 8 spazi + hashtags (#)
 * - Se mancano tutti gli handle o tutti gli hashtag, le righe corrispondenti
 *   vengono omesse (non inseriamo righe vuote)
 */
export function buildShareText(input: ShareTagInput): string {
  const brand = input.brand ?? 'sposilive';
  const handles: string[] = [];
  const hashtags: string[] = [];

  const g1 = normalizeHandle(input.groom1Handle);
  const g2 = normalizeHandle(input.groom2Handle);
  const partner = normalizeHandle(input.partnerHandle);
  if (g1) handles.push(g1);
  if (g2) handles.push(g2);
  handles.push(BRAND_HANDLE[brand]);
  if (partner) handles.push(partner);

  const coupleH = normalizeHashtag(input.coupleHashtag);
  const partnerH = normalizeHashtag(input.partnerHashtag);
  hashtags.push(BRAND_HASHTAG[brand]);
  if (coupleH) hashtags.push(coupleH);
  if (partnerH) hashtags.push(partnerH);
  for (const g of BRAND_GENERIC_HASHTAGS[brand]) hashtags.push(g);

  const lines: string[] = [];
  const userText = (input.userText ?? '').trim();
  if (userText) lines.push(userText);

  const sep = '        '; // 8 spazi
  if (handles.length > 0) lines.push(`${sep}${handles.join(' ')}`);
  if (hashtags.length > 0) lines.push(`${sep}${hashtags.join(' ')}`);

  return lines.join('\n');
}

/**
 * URL di condivisione per la piattaforma scelta, con il testo precompilato.
 *
 * - Facebook: sharer.php con `u` (URL foto) e `quote` (testo precompilato)
 *   Funziona nel piano gratuito di FB, niente API key necessaria.
 * - TikTok: web share URL con `text` (anche URL è supportato). Piano free.
 * - Twitter/X: web intent con `text` + `url`. Piano free.
 * - Instagram: NON supporta precompilazione testo via URL. Ritorna un link
 *   informativo e il client provvederà a copiare il testo negli appunti.
 */
export function buildShareUrl(platform: SharePlatform, input: ShareTagInput): string {
  const text = buildShareText(input);
  const enc = encodeURIComponent;
  const photoUrl = input.photoUrl;

  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(photoUrl || '')}&quote=${enc(text)}`;
    case 'tiktok': {
      // TikTok non accetta un URL foto via web share. Include il testo + titolo.
      // Su desktop TikTok genera una pagina di anteprima; su mobile apre l'app.
      return `https://www.tiktok.com/upload?text=${enc(text)}`;
    }
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(photoUrl || '')}`;
    case 'instagram':
      // Instagram non ha endpoint web share ufficiale. Ritorniamo la home di IG:
      // il client aprirà questo link e平行mente copierà il testo negli appunti.
      return 'https://www.instagram.com/';
  }
}

/** Testo completo copiabile per Instagram (utente incolla manualmente). */
export function buildShareTextForInstagram(input: ShareTagInput): string {
  return buildShareText(input);
}

/**
 * Didascalia DEFAULT precompilata (richiesta cliente 22/09/2026): il campo
 * "Descrizione" del pannello share nasce GIÀ SCRITTO e l'utente può cancellare,
 * modificare o aggiungere a seguire. Vuota se il nome coppia manca.
 */
export function buildDefaultCaption(coupleName?: string | null): string {
  const name = (coupleName || '').trim();
  if (!name) return '';
  return `💍 Una giornata indimenticabile per ${name}! ❤️\nGrazie per aver condiviso con noi questo momento speciale!`;
}
