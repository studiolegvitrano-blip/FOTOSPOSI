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

import { createServiceClient } from '@fotosposi/core';

export interface SocialPost {
  id: string;
  event_id: string;
  platform: 'instagram' | 'tiktok' | 'facebook' | 'other';
  post_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  author_name: string | null;
  author_avatar: string | null;
  embed_html: string | null;
  posted_at: string | null;
  created_at: string;
}

export async function getSocialPosts(eventId: string): Promise<{ posts?: SocialPost[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { posts: data ?? [] };
}

export async function addSocialPost(params: {
  event_id: string;
  platform: SocialPost['platform'];
  post_url: string;
  thumbnail_url?: string;
  caption?: string;
  author_name?: string;
  author_avatar?: string;
  embed_html?: string;
  posted_at?: string;
}): Promise<{ post?: SocialPost; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('social_posts').insert(params).select().single();
  if (error) return { error: error.message };
  return { post: data };
}

export async function fetchOEmbed(postUrl: string): Promise<{
  html?: string;
  thumbnail_url?: string;
  author_name?: string;
  title?: string;
}> {
  const providers: { host: string; endpoint: string }[] = [
    { host: 'instagram.com', endpoint: 'https://www.instagram.com/oembed' },
    { host: 'www.instagram.com', endpoint: 'https://www.instagram.com/oembed' },
    { host: 'tiktok.com', endpoint: 'https://www.tiktok.com/oembed' },
    { host: 'www.tiktok.com', endpoint: 'https://www.tiktok.com/oembed' },
    { host: 'facebook.com', endpoint: 'https://www.facebook.com/plugins/post/oembed.json' },
    { host: 'www.facebook.com', endpoint: 'https://www.facebook.com/plugins/post/oembed.json' },
    { host: 'spotify.com', endpoint: 'https://open.spotify.com/oembed' },
    { host: 'open.spotify.com', endpoint: 'https://open.spotify.com/oembed' },
  ];

  try {
    const urlObj = new URL(postUrl);
    const provider = providers.find(p => urlObj.hostname === p.host);
    if (!provider) return {};

    const oembedUrl = `${provider.endpoint}?url=${encodeURIComponent(postUrl)}&format=json`;
    const res = await fetch(oembedUrl, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return {};

    const data = await res.json();
    return {
      html: data.html,
      thumbnail_url: data.thumbnail_url,
      author_name: data.author_name,
      title: data.title,
    };
  } catch {
    return {};
  }
}

export function getShareUrl(eventId: string, brand: 'fotosposi' | 'weddingmoments'): string {
  const base = typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? '';
  return `${base}/event/${eventId}`;
}
