export type OverlayFormat = 'square' | 'story';

export interface OverlayBranding {
  coupleNames: string;
  date: string;
  primaryColor: string;
  textColor?: string;
  wordmark: string;
  fontFamily?: string;
}

export interface OverlayOptions {
  format: OverlayFormat;
  branding: OverlayBranding;
}

export async function applyOverlay(
  imageBuffer: Buffer,
  options: OverlayOptions,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const { format, branding } = options;
  const textColor = branding.textColor || '#ffffff';
  const fontSize = format === 'story' ? 42 : 28;
  const wordmarkSize = format === 'story' ? 22 : 14;

  const coupleLine = branding.coupleNames;
  const dateLine = branding.date;
  const wordmarkLine = branding.wordmark;

  const bandHeight = format === 'story' ? 140 : 90;
  const padding = format === 'story' ? 40 : 24;

  const svgOverlay = `<svg width="100%" height="${bandHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="${bandHeight}" fill="${branding.primaryColor}" fill-opacity="0.85" rx="0" />
    <text x="${padding}" y="${bandHeight / 2 - 4}"
          font-family="${branding.fontFamily || 'Georgia, serif'}"
          font-size="${fontSize}"
          font-weight="bold"
          fill="${textColor}">
      ${escapeXml(coupleLine)}
    </text>
    <text x="${padding}" y="${bandHeight / 2 + parseInt(String(fontSize)) + 2}"
          font-family="${branding.fontFamily || 'Georgia, serif'}"
          font-size="${Math.round(fontSize * 0.7)}"
          fill="${textColor}" fill-opacity="0.9">
      ${escapeXml(dateLine)}
    </text>
    <text x="100%" y="${bandHeight / 2 + 4}"
          font-family="Inter, sans-serif"
          font-size="${wordmarkSize}"
          fill="${textColor}" fill-opacity="0.6"
          text-anchor="end">
      ${escapeXml(wordmarkLine)}
    </text>
  </svg>`;

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

  const bandSvg = format === 'story'
    ? `<svg width="1080" height="${bandHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="1080" height="${bandHeight}" fill="${branding.primaryColor}" fill-opacity="0.85" />
        <text x="${padding}" y="${bandHeight / 2 - 4}"
              font-family="${branding.fontFamily || 'Georgia, serif'}"
              font-size="${fontSize}" font-weight="bold" fill="${textColor}">${escapeXml(coupleLine)}</text>
        <text x="${padding}" y="${bandHeight / 2 + parseInt(String(fontSize)) + 2}"
              font-family="${branding.fontFamily || 'Georgia, serif'}"
              font-size="${Math.round(fontSize * 0.7)}" fill="${textColor}" fill-opacity="0.9">${escapeXml(dateLine)}</text>
        <text x="1060" y="${bandHeight / 2 + 4}"
              font-family="Inter, sans-serif"
              font-size="${wordmarkSize}" fill="${textColor}" fill-opacity="0.6"
              text-anchor="end">${escapeXml(wordmarkLine)}</text>
      </svg>`
    : `<svg width="100%" height="${bandHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="${bandHeight}" fill="${branding.primaryColor}" fill-opacity="0.85" />
        <text x="${padding}" y="${bandHeight / 2 - 4}"
              font-family="${branding.fontFamily || 'Georgia, serif'}"
              font-size="${fontSize}" font-weight="bold" fill="${textColor}">${escapeXml(coupleLine)}</text>
        <text x="${padding}" y="${bandHeight / 2 + parseInt(String(fontSize)) + 2}"
              font-family="${branding.fontFamily || 'Georgia, serif'}"
              font-size="${Math.round(fontSize * 0.7)}" fill="${textColor}" fill-opacity="0.9">${escapeXml(dateLine)}</text>
        <text x="100%" y="${bandHeight / 2 + 4}"
              font-family="Inter, sans-serif"
              font-size="${wordmarkSize}" fill="${textColor}" fill-opacity="0.6"
              text-anchor="end" transform="translate(-${padding}, 0)">${escapeXml(wordmarkLine)}</text>
      </svg>`;

  const imageMeta = await image.metadata();
  const imgWidth = imageMeta.width || 1080;

  const bandTop = (imageMeta.height || 1920) - bandHeight;

  const svgWidth = format === 'story' ? 1080 : imgWidth;

  const finalSvg = bandSvg.replace('width="100%"', `width="${svgWidth}"`);

  const result = await image
    .composite([{ input: Buffer.from(finalSvg), top: bandTop, left: 0 }])
    .jpeg({ quality: 92 })
    .toBuffer();

  return result;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
