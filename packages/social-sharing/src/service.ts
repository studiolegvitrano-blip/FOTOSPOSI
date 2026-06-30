export interface WatermarkConfig {
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  opacity: number;
  fontSize: number;
  color: string;
}

export function defaultWatermark(brand: 'fotosposi' | 'weddingmoments'): WatermarkConfig {
  return {
    text: brand === 'fotosposi' ? 'FotoSposi' : 'WeddingMoments',
    position: 'bottom-right',
    opacity: 0.5,
    fontSize: 24,
    color: '#ffffff',
  };
}

export async function shareMedia(url: string, title: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    await navigator.share({ title, url });
    return true;
  } catch {
    return false;
  }
}

export async function shareMediaWithFile(file: Blob, title: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;
  try {
    await navigator.share({
      title,
      files: [new File([file], 'photo.jpg', { type: 'image/jpeg' })],
    });
    return true;
  } catch {
    return false;
  }
}

export async function applyWatermark(
  imageUrl: string,
  config: WatermarkConfig,
): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = imageUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');

  ctx.drawImage(img, 0, 0);

  ctx.globalAlpha = config.opacity;
  ctx.font = `bold ${config.fontSize}px sans-serif`;
  ctx.fillStyle = config.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let x = canvas.width / 2;
  let y = canvas.height / 2;

  switch (config.position) {
    case 'top-left':
      x = config.fontSize;
      y = config.fontSize;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      break;
    case 'top-right':
      x = canvas.width - config.fontSize;
      y = config.fontSize;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      break;
    case 'bottom-left':
      x = config.fontSize;
      y = canvas.height - config.fontSize;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      break;
    case 'bottom-right':
      x = canvas.width - config.fontSize;
      y = canvas.height - config.fontSize;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      break;
  }

  ctx.fillText(config.text, x, y);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Watermark generation failed'));
    }, 'image/png');
  });
}

export function getShareUrl(eventId: string, brand: 'fotosposi' | 'weddingmoments'): string {
  const base = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? '';
  return `${base}/event/${eventId}`;
}
