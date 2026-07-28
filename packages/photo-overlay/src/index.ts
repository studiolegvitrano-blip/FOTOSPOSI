export type OverlayFormat = 'square' | 'story';

export interface OverlayBranding {
  coupleNames: string;
  date: string;
  primaryColor: string;
  textColor?: string;
  wordmark: string;
  fontFamily?: string;
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
  // Il `coupleNames` dal caller (process-queue.ts) è già una stringa tipo
  // "Marco ❤ Luca" con il cuore unicode ❤ (U+2764). Lo sostituiamo con l'entità
  // XML &#10084; (rosso) wrappata in un <tspan> per il colore. Il resto della
  // stringa resta testo semplice (escape XML per nomi con &/<).
  const RAW_HEART = '\u2764'; // ❤
  const HEART_ENTITY = '&#10084;';
  const splitMono = branding.coupleNames.split(RAW_HEART);
  let monoLine = '';
  for (let i = 0; i < splitMono.length; i++) {
    monoLine += escapeXml(splitMono[i] || '');
    if (i < splitMono.length - 1) {
      monoLine += ' <tspan fill="#d9534f">' + HEART_ENTITY + '</tspan> ';
    }
  }
  // Dimensione testo: ~3% altezza foto, clampato
  const textPx = Math.min(
    Math.max(10, Math.round(imgHeight * 0.018)),
    format === 'story' ? 28 : 18,
  );
  // Padding piccolo dal bordo
  const padBottom = Math.round(imgHeight * 0.012);
  const padLeft = Math.round(imgWidth * 0.012);

  // SVG watermark (una sola riga, in basso a sinistra) — dimensioni assolute (non 100%)
  const watermarkSvg = `<svg width="${imgWidth}" height="${imgHeight}" xmlns="http://www.w3.org/2000/svg">
    <text x="${padLeft}" y="${imgHeight - padBottom}"
          font-family="${escapeXmlAttr(branding.fontFamily || 'Georgia, serif')}"
          font-size="${textPx}" fill="${textColor}" fill-opacity="0.5">${monoLine}</text>
  </svg>`;

  const compositeOps: { input: Buffer; top: number; left: number }[] = [
    { input: Buffer.from(watermarkSvg), top: 0, left: 0 },
  ];

  // ── Logo brand in alto a destra, A COLORI (no mix-blend, no opacità forzata) ──
  if (branding.brandLogoBuffer) {
    const targetLogoW = branding.brandLogoWidth ?? Math.min(400, Math.max(80, Math.round(imgWidth * 0.15)));
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
  confidence: number;
  logoStddev: number;
  namesStddev: number;
  namesEdgeScore: number;
}

const LOGO_STDDEV_THRESHOLD = 12;
const NAMES_STDDEV_THRESHOLD = 6;
const NAMES_EDGE_THRESHOLD = 8;

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

  // ── Regione top-right: dove va il logo brand ──
  const logoSize = Math.max(40, Math.round(Math.min(imgWidth, imgHeight) * 0.15));
  const logoLeft = Math.max(0, imgWidth - logoSize - Math.round(imgWidth * 0.02));
  const logoTop = Math.round(imgHeight * 0.02);
  const logoStats = await sharp(imageBuffer)
    .extract({ left: logoLeft, top: logoTop, width: logoSize, height: logoSize })
    .resize(32, 32, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const logoStddev = computeStddev(logoStats.data);

  // ── Regione bottom-left: dove vanno i nomi (testo piccolo) ──
  const namesW = Math.max(80, Math.round(imgWidth * 0.35));
  const namesH = Math.max(20, Math.round(imgHeight * 0.05));
  const namesLeft = Math.round(imgWidth * 0.012);
  const namesTop = Math.max(0, imgHeight - namesH - Math.round(imgHeight * 0.012));
  const namesRaw = await sharp(imageBuffer)
    .extract({ left: namesLeft, top: namesTop, width: namesW, height: namesH })
    .resize(128, 16, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  const namesStddev = computeStddev(namesRaw);
  const namesEdgeScore = computeHorizontalEdges(namesRaw, 128);

  const hasLogo = logoStddev >= LOGO_STDDEV_THRESHOLD;
  const hasNames = namesStddev >= NAMES_STDDEV_THRESHOLD && namesEdgeScore >= NAMES_EDGE_THRESHOLD;
  // confidence: pesato 60% nomi + 40% logo (i nomi sono il segnale più affidabile)
  const namesConf = clamp01(
    0.6 * (namesStddev / (NAMES_STDDEV_THRESHOLD * 3)) +
    0.4 * (namesEdgeScore / (NAMES_EDGE_THRESHOLD * 3)),
  );
  const logoConf = clamp01(logoStddev / (LOGO_STDDEV_THRESHOLD * 3));
  const confidence = clamp01(0.6 * namesConf + 0.4 * logoConf);

  return {
    hasLogo,
    hasNames,
    confidence,
    logoStddev,
    namesStddev,
    namesEdgeScore,
  };
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
