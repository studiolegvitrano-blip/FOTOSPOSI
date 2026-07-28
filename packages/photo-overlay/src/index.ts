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
