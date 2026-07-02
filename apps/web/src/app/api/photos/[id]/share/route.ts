import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';

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

  const cachePath = `overlays/${eventId}/${id}_${format}.jpg`;
  const { data: cached } = await supabase.storage.from('media').getPublicUrl(cachePath);
  if (cached?.publicUrl) {
    const headResp = await fetch(cached.publicUrl, { method: 'HEAD' });
    if (headResp.ok) {
      const cachedResp = await fetch(cached.publicUrl);
      const cachedBlob = await cachedResp.blob();
      return new NextResponse(cachedBlob, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }
  }

  const { data: media } = await supabase
    .from('media_uploads')
    .select('url, type')
    .eq('id', id)
    .single();

  if (!media) {
    return new NextResponse('Media not found', { status: 404 });
  }

  if (media.type !== 'photo') {
    return new NextResponse('Only photos support overlay', { status: 400 });
  }

  const mediaUrl = media.url.startsWith('http')
    ? media.url
    : `${supabaseUrl}/storage/v1/object/public/media/${media.url}`;

  const imgResp = await fetch(mediaUrl);
  if (!imgResp.ok) {
    return new NextResponse('Image not found', { status: 404 });
  }
  const imageBuffer = Buffer.from(await imgResp.arrayBuffer());

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

  const { applyOverlay } = await import('@fotosposi/photo-overlay');
  const result = await applyOverlay(imageBuffer, {
    format: format as 'square' | 'story',
    branding: {
      coupleNames: event.couple_name,
      date: new Date(event.date).toLocaleDateString('it-IT'),
      primaryColor,
      wordmark,
      fontFamily,
    },
  });

  try {
    await supabase.storage.from('media').upload(cachePath, result, {
      contentType: 'image/jpeg',
      upsert: true,
    });
  } catch {
    // Cache failure is non-fatal
  }

  return new NextResponse(new Blob([result.buffer as ArrayBuffer], { type: 'image/jpeg' }), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
