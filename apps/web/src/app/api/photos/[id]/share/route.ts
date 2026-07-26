import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';
import { watermarkFontFamily } from '@/lib/watermark-fonts';
import { ensureWatermarkFonts, loadBrandLogo } from '@/lib/watermark-fonts.server';

ensureWatermarkFonts();

// Video watermarking shells out to ffmpeg and can take longer than the default 10s —
// needs the Node.js runtime (not Edge) and a higher time budget.
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  const format = searchParams.get('format') || 'square';

  if (!eventId) {
    return new NextResponse('Missing eventId', { status: 400 });
  }

  if (format !== 'square' && format !== 'story') {
    return new NextResponse('Invalid format. Use square or story.', { status: 400 });
  }

  const supabase = createServiceClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  let { data: media } = await supabase
    .from('media_uploads')
    .select('url, type, r2_key')
    .eq('id', id)
    .maybeSingle();

  // I video del Video Guestbook non sono in `media_uploads` ma in `video_messages` — senza
  // questo fallback il watermark non era mai raggiungibile per quei video (404 sempre).
  let isGuestbookVideo = false;
  if (!media) {
    const { data: videoMessage } = await supabase
      .from('video_messages')
      .select('url, r2_key')
      .eq('id', id)
      .maybeSingle();
    if (videoMessage) {
      media = { url: videoMessage.url, type: 'video', r2_key: videoMessage.r2_key };
      isGuestbookVideo = true;
    }
  }

  if (!media) {
    return new NextResponse('Media not found', { status: 404 });
  }

  const isVideo = media.type === 'video';
  const contentType = isVideo ? 'video/mp4' : 'image/jpeg';

  // File caricati dopo la migrazione a R2 hanno `r2_key` valorizzato — serve un presigned URL,
  // il vecchio path via Supabase Storage pubblico non funziona più per quelli.
  const mediaUrl = media.r2_key
    ? await getPresignedDownloadUrl(media.r2_key, 300)
    : media.url.startsWith('http')
      ? media.url
      : `${supabaseUrl}/storage/v1/object/public/media/${media.url}`;

  if (!mediaUrl) {
    return new NextResponse('Media URL not available', { status: 500 });
  }

  const srcResp = await fetch(mediaUrl);
  if (!srcResp.ok) {
    return new NextResponse(isVideo ? 'Video not found' : 'Image not found', { status: 404 });
  }
  const srcBuffer = Buffer.from(await srcResp.arrayBuffer());

  const { data: event } = await supabase
    .from('events')
    .select('couple_name, date, brand, watermark_font')
    .eq('id', eventId)
    .single();

  if (!event) {
    return new NextResponse('Event not found', { status: 404 });
  }

  const { data: branding } = await supabase
    .from('event_branding')
    .select('primary_color, font_family, logo_url, show_wordmark')
    .eq('event_id', eventId)
    .maybeSingle();

  const primaryColor = branding?.primary_color || '#d4a574';
  const fontFamily = branding?.font_family || watermarkFontFamily((event as { watermark_font?: string }).watermark_font);
  const wordmark = event.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
  const brandLogoBuffer = loadBrandLogo(event.brand);
  const brandingConfig = {
    coupleNames: event.couple_name,
    date: new Date(event.date).toLocaleDateString('it-IT'),
    primaryColor,
    wordmark,
    fontFamily,
    // Per photo-overlay (nuovo overlay)
    brandLogoBuffer,
    brandLogoWidth: format === 'story' ? 360 : 200,
    // Per video-overlay (legacy interface: nome diverso)
    logoPng: brandLogoBuffer ?? undefined,
  };

  let result: Buffer;
  if (isVideo) {
    const { applyVideoOverlay } = await import('@fotosposi/video-overlay');
    result = await applyVideoOverlay(srcBuffer, { branding: brandingConfig });
  } else {
    const { applyOverlay } = await import('@fotosposi/photo-overlay');
    result = await applyOverlay(srcBuffer, { format: format as 'square' | 'story', branding: brandingConfig });
  }

  // Nota: cache rimossa (era su Supabase Storage, ora migrato a R2). L'overlay viene
  // rigenerato ad ogni richiesta — sharp è veloce (~50ms per foto). Per video è più lento
  // (ffmpeg) ma l'uso tipico è foto. Caching futuro su R2 con namespace dedicato se serve.

  return new NextResponse(new Blob([result.buffer as ArrayBuffer], { type: contentType }), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
