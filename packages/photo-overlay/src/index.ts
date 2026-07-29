export type OverlayFormat = 'square' | 'story';

export interface OverlayBranding {
  coupleNames: string;
  date: string;
  primaryColor: string;
  textColor?: string;
  wordmark: string;
  fontFamily?: string;
  /**
   * Bytes del TTF selezionato dagli sposi (events.watermark_font → ttfFile),
   * letto dal caller (apps/web: watermark-fonts.server.ts) e passato qui già
   * in memoria. Se presente, il font viene EMBEDDATO nell'SVG via @font-face
   * + data URI base64: questo bypassa completamente fontconfig di sistema,
   * che nelle lambda Vercel non è affidabile (vedi bug 28/07/2026 — fontconfig
   * senza font validi non lancia errore, sharp usa un fallback bundolato e il
   * font richiesto viene silenziosamente sostituito).
   * Se assente, si torna al comportamento legacy (font-family testuale,
   * risolto da fontconfig/dal fallback di sharp — meno affidabile ma non rompe).
   */
  fontBuffer?: Buffer | null;
  /** Logo PNG brand (es. Sposi.live/JustMarry.live) da sovrapporre in alto a destra A COLORI.
   *  Deve essere un Buffer PNG con trasparenza. Se assente, resta solo la parola wordmark. */
  brandLogoBuffer?: Buffer | null;
  /** Larghezza del logo brand in px (default 15% della larghezza foto, min 80 max 400). */
  brandLogoWidth?: number;
}

export interface OverlayOptions {
  format: OverlayFormat;
  branding: OverlayBranding;
}

/**
 * Watermark come da specifica utente (sessione 27/07/2026):
 *   - SOLO i nomi separati da ❤, su una sola riga in basso a sinistra.
 *     Es. "Marco ❤ Luca" (no data, no wordmark, niente banda colorata).
 *     Il campo `branding.coupleNames` deve contenere già la stringa formattata
 *     (il caller in process-queue.ts compone "Marco Rossi ❤ Luca Bianchi" se ha
 *     i campi groom1/groom2, altrimenti fallback a couple_name).
 *   - Font piccolo (~3% dell'altezza foto, clampato 10–18px su square, 16–28 su story)
 *   - Cuore SEMPRE rosso (#d9534f), testo auto black/white in base alla luminanza
 *     della fascia bassa della foto (campionata via sharp.stats sulla region bottom-25%)
 *   - Opacità testo 50%
 *   - nessuna banda colorata di sfondo (filigrana integrata sulla foto)
 *   - Logo brand in alto a destra A COLORI, senza mix-blend, senza opacità forzata
 */
export async function applyOverlay(
  imageBuffer: Buffer,
  options: OverlayOptions,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const { format, branding } = options;

  // ── Pipeline setup: per story ridimensioniamo su 1080×1920 ──
  let image = sharp(imageBuffer);
  if (format === 'story') {
    const meta = await image.metadata();
    const w = meta.width || 1080;
    const h = meta.height || 1920;
    const targetW = 1080;
    const targetH = 1920;
    const scale = Math.min(targetW / w, targetH / h);
    const dw = Math.round(w * scale);
    const dh = Math.round(h * scale);
    const padX = Math.round((targetW - dw) / 2);
    const padY = Math.round((targetH - dh) / 2);
    image = sharp({
      create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    }).composite([
      { input: await image.resize(dw, dh, { fit: 'inside' }).toBuffer(), top: padY, left: padX },
    ]);
  }

  const imageMeta = await image.metadata();
  const imgWidth = imageMeta.width || 1080;
  const imgHeight = imageMeta.height || (format === 'story' ? 1920 : 1080);

  // ── Luminanza della fascia bassa per scegliere il colore testo ──
  const bottomStripHeight = Math.max(1, Math.floor(imgHeight * 0.25));
  const bottomStrip = sharp(imageBuffer)
    .extract({ left: 0, top: Math.max(0, imgHeight - bottomStripHeight), width: Math.min(imgWidth, imageMeta.width || imgWidth), height: bottomStripHeight })
    .resize(64, 16, { fit: 'fill' })
    .raw();
  let avgLuma = 0.5; // safe default = scuro → testo bianco
  try {
    const stats = await bottomStrip.stats();
    // stats.channels: ChannelStats[] in ordine R, G, B (e A se presente)
    const channels = stats.channels ?? [];
    const r = channels[0]?.mean ?? 128;
    const g = channels[1]?.mean ?? 128;
    const b = channels[2]?.mean ?? 128;
    avgLuma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  } catch (statsErr) {
    // Non bloccare: la luminanza serve solo per scegliere il colore testo, fallback safe.
    console.warn('[applyOverlay] sharp.stats() fallito, uso luma default 0.5:', statsErr instanceof Error ? statsErr.message : statsErr);
  }
  const autoText = avgLuma < 0.5 ? '#ffffff' : '#000000';
  const textColor = branding.textColor && branding.textColor !== 'auto' ? branding.textColor : autoText;

  // ── Costruisce la riga monogramma: SOLO i nomi separati da ❤ ──
  // FIX 28/07/2026 (bug watermark invisibile): il cuore NON viene più
  // renderizzato come glifo di testo Unicode (U+2764, entità &#10084;).
  // Verificato empiricamente: quando fontconfig lato lambda non trova il
  // font richiesto, sharp/rsvg sostituisce con un font di fallback bundolato
  // che rende correttamente lettere latine MA non include il glifo ❤ (blocco
  // Dingbats) → il cuore spariva silenziosamente (0 pixel rossi), mentre i
  // nomi sembravano presenti e ingannavano detectWatermark. Un path SVG
  // vettoriale non dipende da NESSUN font ed è sempre renderizzato.
  const RAW_HEART = '\u2764'; // ❤ — usato solo per fare lo split della stringa in input
  const splitMono = branding.coupleNames.split(RAW_HEART);
  // Dimensione testo (FIX 29/07/2026: raddoppiato su richiesta utente):
  // ~3.6% altezza foto (era 1.8%), clampato 20-36px square / 20-56px story.
  const textPx = Math.min(
    Math.max(20, Math.round(imgHeight * 0.036)),
    format === 'story' ? 56 : 36,
  );
  const heartSize = Math.round(textPx * 0.85);
  // Padding piccolo dal bordo (proporzionato, lievemente aumentato)
  const padBottom = Math.round(imgHeight * 0.018);
  const padLeft = Math.round(imgWidth * 0.018);
  const baselineY = imgHeight - padBottom;

  // Costruiamo la riga come sequenza di <tspan> di testo intervallati da un
  // <path> vettoriale per ogni ❤ trovato nella stringa. Usiamo x assoluti
  // calcolati con una stima di larghezza (non abbiamo accesso al layout reale
  // pre-render): overstimiamo leggermente la larghezza dei caratteri latini
  // (60% della font-size) per evitare sovrapposizioni testo/cuore — un piccolo
  // gap in più è visivamente innocuo, una sovrapposizione non lo è.
  const CHAR_WIDTH_ESTIMATE = textPx * 0.58;
  let cursorX = padLeft;
  const textParts: string[] = [];
  const heartParts: string[] = [];
  for (let i = 0; i < splitMono.length; i++) {
    const segment = escapeXml(splitMono[i] || '');
    const segmentLen = (splitMono[i] || '').length;
    if (segment) {
      textParts.push(`<tspan x="${cursorX}" y="${baselineY}">${segment}</tspan>`);
      cursorX += segmentLen * CHAR_WIDTH_ESTIMATE;
    }
    if (i < splitMono.length - 1) {
      cursorX += textPx * 0.25; // gap prima del cuore
      heartParts.push(heartPathSvg(cursorX, baselineY, heartSize));
      cursorX += heartSize + textPx * 0.3; // gap dopo il cuore
    }
  }
  const monoTextSvg = textParts.join('');
  const monoHeartsSvg = heartParts.join('');

  // ── Font embeddato via @font-face (bypassa fontconfig di sistema) ──
  // Se il caller (process-queue.ts) ci passa i bytes del TTF selezionato dagli
  // sposi, lo incorporiamo come data URI. Inoltre specifichiamo SEMPRE anche
  // il family testuale come fallback nella lista font-family: librsvg/inkscape
  // su Vercel lambda non risolve sempre @font-face con data URI, ma se il
  // fontconfig di sistema (configurato da ensureWatermarkFonts per puntare a
  // apps/web/assets/fonts) conosce il family del TTF, lo usa come fallback.
  // Risultato: il font corretto viene applicato in entrambi i casi.
  let fontFaceDefs = '';
  const requestedFamily = branding.fontFamily || 'Georgia, serif';
  let resolvedFontFamily = escapeXmlAttr(requestedFamily);
  if (branding.fontBuffer && branding.fontBuffer.length > 0) {
    const fontB64 = branding.fontBuffer.toString('base64');
    // Font-family = embedded PRIMA + family testuale come fallback. Così se
    // librsvg ignora @font-face data URI (caso osservato su Vercel), fontconfig
    // intercetta tramite il family testuale e usa il TTF già installato in
    // assets/fonts/.
    resolvedFontFamily = `'WatermarkEmbeddedFont', ${escapeXmlAttr(requestedFamily)}`;
    fontFaceDefs = `<defs><style>
      @font-face { font-family: 'WatermarkEmbeddedFont'; src: url(data:font/ttf;base64,${fontB64}) format('truetype'); }
    </style></defs>`;
    console.log(`[applyOverlay] font: embedded base64 (${branding.fontBuffer.length} bytes), family='${requestedFamily}'`);
  } else {
    console.log(`[applyOverlay] font: NO buffer (font='${branding.fontFamily}'), uso family testuale`);
  }

  // SVG watermark (una sola riga, in basso a sinistra) — dimensioni assolute (non 100%)
  const watermarkSvg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
    ${fontFaceDefs}
    <text font-family="${resolvedFontFamily}" font-size="${textPx}" fill="${textColor}" fill-opacity="0.5">${monoTextSvg}</text>
    ${monoHeartsSvg}
  </svg>`;

  const compositeOps: { input: Buffer; top: number; left: number }[] = [
    { input: Buffer.from(watermarkSvg), top: 0, left: 0 },
  ];

  // ── Logo brand in alto a destra, A COLORI (no mix-blend, no opacità forzata) ──
  // FIX 29/07/2026 (terzo passaggio): dopo "raddoppia" l'utente ha chiesto "-15%".
  // Dal 30% passiamo a 25.5% (= 30% × 0.85). Clamp 135-680px.
  if (branding.brandLogoBuffer) {
    const targetLogoW = branding.brandLogoWidth ?? Math.min(680, Math.max(135, Math.round(imgWidth * 0.255)));
    try {
      const resizedLogo = await sharp(branding.brandLogoBuffer)
        .resize(targetLogoW, null, { fit: 'inside' })
        .toBuffer();
      const logoMeta = await sharp(resizedLogo).metadata();
      const logoW = logoMeta.width || targetLogoW;
      const logoH = logoMeta.height || Math.round(targetLogoW * 0.5);
      const logoTop = Math.round(imgHeight * 0.02);
      const logoRight = Math.round(imgWidth * 0.02);
      const logoLeft = Math.max(0, imgWidth - logoW - logoRight);
      console.log(`[applyOverlay] logo: img=${imgWidth}x${imgHeight}, targetW=${targetLogoW}, resized=${logoW}x${logoH}, top=${logoTop}, left=${logoLeft}`);
      compositeOps.push({ input: resizedLogo, top: logoTop, left: logoLeft });
    } catch (e) {
      console.error('watermark brand logo err:', e);
    }
  }

  let result: Buffer;
  try {
    result = await image
      .composite(compositeOps)
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (renderErr) {
    // Log granulare per capire se il problema è sharp.composite, l'SVG malformato,
    // l'encoder jpeg o la libreria sharp stessa. Su Vercel lambda spesso è
    // sharp libvips non disponibile o font TTF mancanti (fontconfig cade → librsvg
    // rasterizza tofu senza errori, ma il composite fallisce se il buffer SVG è 0 byte).
    console.error('[applyOverlay] render fallito:', renderErr instanceof Error ? renderErr.message : renderErr);
    console.error('[applyOverlay] contesto:', {
      imgWidth,
      imgHeight,
      compositeOpsCount: compositeOps.length,
      fontFamily: branding.fontFamily,
      wordmark: branding.wordmark,
      hasLogo: !!branding.brandLogoBuffer,
      svgLength: watermarkSvg.length,
      svgStart: watermarkSvg.slice(0, 200),
    });
    throw renderErr;
  }

  console.log(`[applyOverlay] OK: ${imgWidth}x${imgHeight} → ${result.length} bytes (input ${imageBuffer.length})`);
  return result;
}

/**
 * Genera un <path> SVG di un cuore pieno, rosso fisso (#d9534f come da
 * specifica), centrato orizzontalmente su `centerX` con la punta appoggiata
 * sulla baseline `baselineY` (coerente con l'allineamento del testo accanto).
 * `size` è l'altezza approssimativa del cuore in px.
 *
 * Perché un path invece di un carattere ❤ / entità &#10084;: verificato in
 * sandbox (28/07/2026) che il glifo Unicode del cuore (blocco Dingbats,
 * U+2764) NON è presente nel font di fallback che sharp/rsvg usa quando il
 * font richiesto non è risolvibile via fontconfig — risultato: 0 pixel rossi,
 * cuore invisibile, pur con testo circostante renderizzato correttamente. Un
 * path vettoriale è indipendente da qualsiasi font ed è SEMPRE renderizzato.
 */
function heartPathSvg(centerX: number, baselineY: number, size: number): string {
  const s = size / 20; // path disegnato su una griglia 20x20, poi scalato
  const cx = centerX + size / 2;
  const topY = baselineY - size;
  return `<path fill="#d9534f" d="
    M ${cx} ${topY + 6 * s}
    C ${cx} ${topY + 2 * s}, ${cx - 5 * s} ${topY}, ${cx - 8 * s} ${topY + 3 * s}
    C ${cx - 11 * s} ${topY + 6 * s}, ${cx - 11 * s} ${topY + 10 * s}, ${cx - 5 * s} ${topY + 15 * s}
    C ${cx - 2 * s} ${topY + 18 * s}, ${cx} ${topY + 20 * s}, ${cx} ${topY + 20 * s}
    C ${cx} ${topY + 20 * s}, ${cx + 2 * s} ${topY + 18 * s}, ${cx + 5 * s} ${topY + 15 * s}
    C ${cx + 11 * s} ${topY + 10 * s}, ${cx + 11 * s} ${topY + 6 * s}, ${cx + 8 * s} ${topY + 3 * s}
    C ${cx + 5 * s} ${topY}, ${cx} ${topY + 2 * s}, ${cx} ${topY + 6 * s}
    Z"/>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeXmlAttr(s: string): string {
  return escapeXml(s);
}

// ─────────────────────────────────────────────────────────────────────
// detectWatermark — verifica euristica presenza watermark su un'immagine
// già processata. Usata da process-queue.ts come self-healing check:
// se dopo applyOverlay il file su R2 NON ha traccia visibile del watermark,
// marchiamo l'item come failed invece di 'synced' (così l'utente vede il
// problema invece di credere che tutto sia ok).
//
// Strategia (veloce, no ML, no OCR pesante):
//   1. Campiono 2 regioni: top-right (logo brand) e bottom-left (nomi).
//   2. Per ogni regione calcolo stddev luma: il watermark introduce
//      discontinuità → stddev più alto rispetto allo sfondo uniforme.
//   3. Logo region: stddev > LOGO_STDDEV_THRESHOLD (colori vividi logo).
//   4. Names region: stddev > NAMES_STDDEV_THRESHOLD + presenza di edge
//      orizzontali (testo = tanti cambi chiaro/scuro ravvicinati).
//   5. Confidence = combinazione dei due segnali.
//
// Limiti noti (documentati):
//   - Foto con molto rumore/alta varianza naturale (es. coriandoli, luci
//     festa) può dare falso positivo → meglio essere conservativi.
//   - Foto quasi monocromatiche (es. cerimonia religiosa toni beige)
//     possono dare falso negativo → confidence < 0.5 = "incerto, riprova".
//   - Non tenta OCR reale (sarebbe lento in lambda): la verifica è
//     strutturale (qualcosa è stato disegnato nella zona attesa).
// ─────────────────────────────────────────────────────────────────────
export interface WatermarkPresence {
  hasLogo: boolean;
  hasNames: boolean;
  /** true se sono stati trovati pixel del colore rosso fisso del cuore (#d9534f) nella regione nomi. */
  hasHeart: boolean;
  confidence: number;
  logoStddev: number;
  namesStddev: number;
  namesEdgeScore: number;
  redPixelCount: number;
}

// FIX 28/07/2026 (bug 40 foto senza watermark rilevato come watermark_missing=false):
//   - Regione logo ridotta da 15%x15% a 10%x8%: su foto piccole (480×640) la
//     regione precedente era abbastanza grande da inglobare contenuto naturale
//     della foto (viso, cielo, decorazioni) con varianza sufficiente a superare
//     una soglia bassa → falso positivo "logo presente".
//   - Soglia stddev logo alzata da 12 a 20: 12 si è dimostrata troppo permissiva,
//     superata da variazioni naturali della foto originale (senza alcun logo).
//   - NUOVO: conteggio diretto di pixel color-match sul rosso fisso del cuore
//     (#d9534f) nella regione nomi, in RGB reale (non stddev in scala di grigi).
//     Il vecchio euristico (stddev+edge) veniva soddisfatto dal solo TESTO dei
//     nomi (che renderizzava comunque con un font di fallback) anche quando il
//     cuore — il segnale più specifico e ricercabile — non era mai apparso.
const LOGO_STDDEV_THRESHOLD = 20;
const NAMES_STDDEV_THRESHOLD = 10;
const NAMES_EDGE_THRESHOLD = 8;
const MIN_RED_HEART_PIXELS = 15;

/**
 * Verifica se un'immagine (JPEG/PNG buffer) mostra tracce del watermark.
 * NON riapplica il watermark: serve solo a diagnosticare se
 * applyOverlay ha effettivamente scritto qualcosa.
 */
export async function detectWatermark(imageBuffer: Buffer): Promise<WatermarkPresence> {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(imageBuffer).metadata();
  const imgWidth = meta.width || 1080;
  const imgHeight = meta.height || 1080;

  // ── Regione top-right: dove va il logo brand (10%x8%, non più 15%x15%) ──
  const logoW = Math.max(32, Math.round(imgWidth * 0.10));
  const logoH = Math.max(24, Math.round(imgHeight * 0.08));
  const logoLeft = Math.max(0, imgWidth - logoW - Math.round(imgWidth * 0.02));
  const logoTop = Math.round(imgHeight * 0.02);
  const logoStats = await sharp(imageBuffer)
    .extract({ left: logoLeft, top: logoTop, width: logoW, height: logoH })
    .resize(32, 32, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const logoStddev = computeStddev(logoStats.data);

  // ── Regione bottom-left: dove vanno i nomi + cuore ──
  const namesW = Math.max(80, Math.round(imgWidth * 0.35));
  const namesH = Math.max(20, Math.round(imgHeight * 0.05));
  const namesLeft = Math.round(imgWidth * 0.012);
  const namesTop = Math.max(0, imgHeight - namesH - Math.round(imgHeight * 0.012));
  const namesRegionRgb = sharp(imageBuffer)
    .extract({ left: namesLeft, top: namesTop, width: namesW, height: namesH });

  const namesRaw = await namesRegionRgb
    .clone()
    .resize(128, 16, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  const namesStddev = computeStddev(namesRaw);
  const namesEdgeScore = computeHorizontalEdges(namesRaw, 128);

  // Conteggio pixel rossi in RGB reale (senza resize, per non "diluire" il
  // colore del cuore mescolandolo con pixel vicini durante l'interpolazione).
  const { data: namesRgbData, info: namesRgbInfo } = await namesRegionRgb
    .clone()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const redPixelCount = countRedHeartPixels(namesRgbData, namesRgbInfo.channels);

  const hasLogo = logoStddev >= LOGO_STDDEV_THRESHOLD;
  const hasNames = namesStddev >= NAMES_STDDEV_THRESHOLD && namesEdgeScore >= NAMES_EDGE_THRESHOLD;
  const hasHeart = redPixelCount >= MIN_RED_HEART_PIXELS;

  // confidence: il cuore (colore deterministico, quasi impossibile in una foto
  // di matrimonio per caso) è il segnale più affidabile e pesa la maggioranza;
  // logo e testo generico pesano meno perché più soggetti a falsi positivi.
  const heartConf = clamp01(redPixelCount / (MIN_RED_HEART_PIXELS * 3));
  const namesConf = clamp01(
    0.5 * (namesStddev / (NAMES_STDDEV_THRESHOLD * 3)) +
    0.5 * (namesEdgeScore / (NAMES_EDGE_THRESHOLD * 3)),
  );
  const logoConf = clamp01(logoStddev / (LOGO_STDDEV_THRESHOLD * 3));
  const confidence = clamp01(0.5 * heartConf + 0.25 * namesConf + 0.25 * logoConf);

  return {
    hasLogo,
    hasNames,
    hasHeart,
    confidence,
    logoStddev,
    namesStddev,
    namesEdgeScore,
    redPixelCount,
  };
}

/**
 * Conta i pixel della regione RGB (raw, senza alpha) che rientrano nella
 * tolleranza cromatica del rosso fisso del cuore (#d9534f = rgb(217,83,79)).
 * Soglia larga a sufficienza da tollerare compressione JPEG/antialiasing sui
 * bordi del path, ma specifica abbastanza da escludere pelle, tramonti, luci
 * calde di festa (che sono normalmente più sature verso l'arancio o più chiare).
 */
function countRedHeartPixels(raw: Buffer, channels: number): number {
  let count = 0;
  for (let i = 0; i + 2 < raw.length; i += channels) {
    const r = raw[i] ?? 0;
    const g = raw[i + 1] ?? 0;
    const b = raw[i + 2] ?? 0;
    if (r > 150 && r < 255 && g < 130 && b < 130 && (r - g) > 50 && (r - b) > 50 && Math.abs(g - b) < 40) {
      count++;
    }
  }
  return count;
}

function computeStddev(raw: Buffer): number {
  if (raw.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < raw.length; i++) sum += raw[i] ?? 0;
  const mean = sum / raw.length;
  let variance = 0;
  for (let i = 0; i < raw.length; i++) {
    const d = (raw[i] ?? 0) - mean;
    variance += d * d;
  }
  return Math.sqrt(variance / raw.length);
}

/**
 * Conta "edge transitions" orizzontali: passaggi ripidi luma-alto → luma-basso
 * in colonne adiacenti. Il testo genera molti edge ravvicinati; uno sfondo
 * uniforme ne genera pochi. Restituisce il numero totale di edge nella riga
 * (somma su tutte le 16 righe del buffer 128x16).
 */
function computeHorizontalEdges(raw: Buffer, width: number): number {
  if (raw.length < width * 2) return 0;
  const height = Math.floor(raw.length / width);
  let totalEdges = 0;
  for (let row = 0; row < height; row++) {
    for (let col = 1; col < width; col++) {
      const prev = raw[row * width + col - 1] ?? 0;
      const curr = raw[row * width + col] ?? 0;
      const diff = Math.abs(curr - prev);
      // edge se differenza > 40 su 255 (testo vs sfondo = forte contrasto)
      if (diff > 40) totalEdges++;
    }
  }
  return totalEdges;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
