import { buildCapsuleWatermarkText } from '@fotosposi/time-capsule';
import type { VideoOverlayBranding } from '@fotosposi/video-overlay';
import { watermarkFontFamily } from '@/lib/watermark-fonts';
import { loadBrandLogo, loadPartnerLogo, loadWatermarkFontBuffer } from '@/lib/watermark-fonts.server';

export function getBrandLabel(brand?: string | null): string {
  return brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
}

/**
 * Branding watermark capsula: frase utente + frase nostra (striscia bassa),
 * logo brand alto-dx (Sposi.live/JustMarry.live), logo partner alto-sx,
 * font custom degli sposi, colore adattivo gestito dal renderer.
 */
export async function buildCapsuleBranding(params: {
  brand?: string | null;
  watermarkFont?: string | null;
  partnerLogoUrl?: string | null;
  phrase?: string | null;
}): Promise<VideoOverlayBranding> {
  const brandLogo = loadBrandLogo(params.brand ?? undefined);
  const wmFontBuffer = loadWatermarkFontBuffer(params.watermarkFont);
  const partnerLogo = params.partnerLogoUrl ? await loadPartnerLogo(params.partnerLogoUrl) : null;
  return {
    coupleNames: buildCapsuleWatermarkText(params.phrase),
    date: '',
    primaryColor: '#1a1a2e',
    wordmark: getBrandLabel(params.brand),
    fontFamily: watermarkFontFamily(params.watermarkFont),
    fontBuffer: wmFontBuffer ?? undefined,
    logoPng: brandLogo ?? undefined,
    partnerLogoPng: partnerLogo ?? undefined,
  };
}
