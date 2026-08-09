import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { getPresignedDownloadUrl, getPresignedUploadUrl } from '@fotosposi/r2-storage';
import { watermarkFontFamily } from '@/lib/watermark-fonts';
import { ensureWatermarkFonts, loadBrandLogo, loadPartnerLogo } from '@/lib/watermark-fonts.server';
import { getEventPartner } from '@fotosposi/partner';

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
  // B2B white label: logo partner sponsor (alto a sinistra, speculare al brand).
  const { partner: sharePartner } = await getEventPartner(eventId);
  const partnerLogoBuffer = sharePartner?.logo_url ? await loadPartnerLogo(sharePartner.logo_url) : null;
  const brandingConfig = {
    coupleNames: event.couple_name,
    date: new Date(event.date).toLocaleDateString('it-IT'),
    primaryColor,
    wordmark,
    fontFamily,
    // Per photo-overlay (nuovo overlay)
    brandLogoBuffer,
    brandLogoWidth: format === 'story' ? 360 : 200,
    partnerLogoBuffer,
    partnerLogoWidth: format === 'story' ? 360 : 200,
    // Per video-overlay (legacy interface: nome diverso)
    logoPng: brandLogoBuffer ?? undefined,
    partnerLogoPng: partnerLogoBuffer ?? undefined,
  };

  let result: Buffer | null = null;
  if (isVideo) {
    // Path REMOTO (VPS con ffmpeg di sistema) se configurato. Video >50MB o >90s
    // NON sono gestibili in lambda (maxDuration 60s + bundle 70MB ffmpeg-static): il
    // VPS scarica da R2 via presigned GET, applica watermark, uploada via presigned
    // PUT su una key temporanea, e noi rispondiamo con quel buffer. La dimensione del
    // video originale può essere qualsiasi (200MB+): il limite reale è il timeout
    // della nostra fetch interna (55s) — per clip molto lunghe il VPS risponde
    // subito con 202 accepted e completa l'upload in background; qui attendiamo
    // comunque il completamento per semplicità (da evolvere a job queue in futuro).
    const {
      applyVideoOverlay,
      applyVideoOverlayRemote,
      isVpsWatermarkConfigured,
      brandingToRemote,
    } = await import('@fotosposi/video-overlay');

    const vpsActive = isVpsWatermarkConfigured();
    let remoteOk = false;
    if (vpsActive && media.r2_key) {
      try {
        // Presigned GET del video originale (valido 1h)
        const downloadUrl = await getPresignedDownloadUrl(media.r2_key, 3600);
        // Presigned PUT per la chiave watermarkata. safeKey nel package prefix/filename,
        // qui passiamo prefix vuoto + filename = key watermarkata (.wm.mp4) cosi':
        // la funzione restituisce { success, key, presignedUrl } con key determinata da lei.
        // NO: safeKey genera timestamp, vogliamo una key STABILE legata all'originale.
        // Usiamo invece la chiave reale via presigned-but-direct costruendo noi il path:
        //   prefix = r2_key directory, filename = basename + '.wm.mp4'
        const lastSlash = media.r2_key.lastIndexOf('/');
        const prefix = lastSlash >= 0 ? media.r2_key.substring(0, lastSlash) : '';
        const baseName = lastSlash >= 0 ? media.r2_key.substring(lastSlash + 1) : media.r2_key;
        const wmFilename = baseName.replace(/\.mp4$/i, '') + '.wm.mp4';
        const ul = await getPresignedUploadUrl(prefix, wmFilename, 'video/mp4');
        if (downloadUrl && ul.success && ul.presignedUrl) {
          const remoteResp = await applyVideoOverlayRemote({
            downloadUrl,
            uploadUrl: ul.presignedUrl,
            branding: brandingToRemote(brandingConfig),
            // maxDurationSeconds non passato: il VPS processa sempre (anche ceremony intera)
          });
          if (remoteResp.ok) {
            // Recupera il watermarkato via un terzo presigned GET (in-memory per la response)
            const wmDownloadUrl = await getPresignedDownloadUrl(ul.key, 60);
            if (wmDownloadUrl) {
              const wmResp = await fetch(wmDownloadUrl);
              if (wmResp.ok) {
                result = Buffer.from(await wmResp.arrayBuffer());
                remoteOk = true;
              }
            }
          } else {
            console.warn('[share] VPS watermark failed:', remoteResp.error, '- fallback locale');
          }
        }
      } catch (err) {
        console.warn('[share] VPS watermark exception:', (err as Error).message, '- fallback locale');
      }
    }

    if (!remoteOk) {
      // Fallback locale: lambda con ffmpeg-static. Limite interno 90s per clip.
      // Per video cerimonia intera (>90s) il fallback ritorna IL FILE ORIGINALE senza
      // watermark — meglio un video senza marchio che un 504 timeout. Con VPS attivo
      // invece i video grandi vengono watermarkati correttamente lato VPS.
      result = await applyVideoOverlay(srcBuffer, { branding: brandingConfig });
    }
  } else {
    const { applyOverlay } = await import('@fotosposi/photo-overlay');
    result = await applyOverlay(srcBuffer, { format: format as 'square' | 'story', branding: brandingConfig });
  }

  // Nota: cache rimossa (era su Supabase Storage, ora migrato a R2). L'overlay viene
  // rigenerato ad ogni richiesta — sharp è veloce (~50ms per foto). Per video è più lento
  // (ffmpeg) ma l'uso tipico è foto. Caching futuro su R2 con namespace dedicato se serve.

  if (!result) {
    return new NextResponse('Watermark processing failed', { status: 500 });
  }
  return new NextResponse(new Blob([result.buffer as ArrayBuffer], { type: contentType }), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
