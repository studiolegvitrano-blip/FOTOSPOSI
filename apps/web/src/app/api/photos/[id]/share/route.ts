import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';

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

  const { data: media } = await supabase
    .from('media_uploads')
    .select('url, type')
    .eq('id', id)
    .single();

  if (!media) {
    return new NextResponse('Media not found', { status: 404 });
  }

  const isVideo = media.type === 'video';
  const cacheExt = isVideo ? 'mp4' : 'jpg';
  const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
  const cachePath = `overlays/${eventId}/${id}_${format}.${cacheExt}`;

  const { data: cached } = await supabase.storage.from('media').getPublicUrl(cachePath);
  if (cached?.publicUrl) {
    const headResp = await fetch(cached.publicUrl, { method: 'HEAD' });
    if (headResp.ok) {
      const cachedResp = await fetch(cached.publicUrl);
      const cachedBlob = await cachedResp.blob();
      return new NextResponse(cachedBlob, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  const mediaUrl = media.url.startsWith('http')
    ? media.url
    : `${supabaseUrl}/storage/v1/object/public/media/${media.url}`;

  const srcResp = await fetch(mediaUrl);
  if (!srcResp.ok) {
    return new NextResponse(isVideo ? 'Video not found' : 'Image not found', { status: 404 });
  }
  const srcBuffer = Buffer.from(await srcResp.arrayBuffer());

  const { data: event } = await supabase
    .from('events')
    .select('couple_name, date, brand')
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
  const fontFamily = branding?.font_family || 'Georgia, serif';
  const wordmark = event.brand === 'fotosposi' ? 'fotosposi.it' : 'weddingmoments.app';
  const brandingConfig = {
    coupleNames: event.couple_name,
    date: new Date(event.date).toLocaleDateString('it-IT'),
    primaryColor,
    wordmark,
    fontFamily,
  };

  let result: Buffer;
  if (isVideo) {
    const { applyVideoOverlay } = await import('@fotosposi/video-overlay');
    result = await applyVideoOverlay(srcBuffer, { branding: brandingConfig });
  } else {
    const { applyOverlay } = await import('@fotosposi/photo-overlay');
    result = await applyOverlay(srcBuffer, { format: format as 'square' | 'story', branding: brandingConfig });
  }

  try {
    await supabase.storage.from('media').upload(cachePath, result, {
      contentType,
      upsert: true,
    });
  } catch {
    // Cache failure is non-fatal
  }

  return new NextResponse(new Blob([result.buffer as ArrayBuffer], { type: contentType }), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
