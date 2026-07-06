import { NextRequest, NextResponse } from 'next/server';
import { createVideoMessage, getVideoMessages } from '@fotosposi/media';
import { createServiceClient } from '@fotosposi/core';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';
import { applyVideoOverlay } from '@fotosposi/video-overlay';

// Il watermark video ri-codifica il clip con ffmpeg: serve il runtime Node e tempo
// oltre il default. I clip guestbook durano max ~30s, ampiamente nei limiti.
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Server-side proxy for video guestbook messages.
 *
 * `createVideoMessage`/`getVideoMessages` already call `createServiceClient()`, but that function
 * silently falls back to the anon key when run in the browser (the real service role key is a
 * server-only env var, stripped from the client bundle). `video_messages` has no public/anon RLS
 * policy at all, so calling these directly from the guestbook page ('use client') always failed
 * under RLS once the schema issue was fixed. Running them here, server-side, gives them the real
 * service role key and lets them work as intended.
 *
 * In più, PRIMA di registrare il messaggio, brucia il watermark nel video (nomi sposi/testo
 * personalizzato se abilitati + SEMPRE il logo Sposi.live/JustMarry.live) — stessa pipeline
 * dei video della galleria (process-queue).
 */
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get('eventId');
  const type = req.nextUrl.searchParams.get('type') as 'welcome' | 'guestbook' | null;
  if (!eventId) return NextResponse.json({ error: 'eventId mancante' }, { status: 400 });

  const { messages, error } = await getVideoMessages(eventId, type ?? undefined);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ messages });
}

async function watermarkGuestbookVideo(eventId: string, r2Key: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: event } = await supabase
    .from('events')
    .select('couple_name, date, brand, watermark_names, watermark_text')
    .eq('id', eventId)
    .single();

  const wordmark = event?.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
  const namesEnabled = event?.watermark_names !== false;
  const customText = (event?.watermark_text || '').trim();
  const line1 = !namesEnabled ? '' : (customText || event?.couple_name || '');
  const line2 = !namesEnabled || customText ? '' : (event?.date ? new Date(event.date).toLocaleDateString('it-IT') : '');

  const downloadUrl = await getPresignedDownloadUrl(r2Key, 3600);
  if (!downloadUrl) return;
  const resp = await fetch(downloadUrl);
  if (!resp.ok) return;
  const original = Buffer.from(await resp.arrayBuffer());

  const branded = await applyVideoOverlay(original, {
    branding: {
      coupleNames: line1,
      date: line2,
      primaryColor: '#1a1a2e',
      wordmark,
    },
    maxDurationSeconds: 240,
  });
  if (branded === original) return; // video troppo lungo: lasciato originale

  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET || 'fotosposi-uploads',
    Key: r2Key,
    Body: branded,
    ContentType: 'video/mp4', // l'overlay ri-codifica sempre in H.264/AAC MP4
  }));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { event_id, from_user, from_name, type, url, r2_key, is_public } = body;
  if (!event_id || !from_user || !type || !url) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
  }

  // Watermark prima della pubblicazione. Se ffmpeg fallisce (codec esotico, video
  // corrotto) pubblichiamo comunque l'originale: meglio senza watermark che perso.
  if (r2_key) {
    try {
      await watermarkGuestbookVideo(event_id, r2_key);
    } catch (e) {
      console.error('Watermark guestbook fallito:', e);
    }
  }

  const { message, error } = await createVideoMessage({
    event_id,
    from_user,
    from_name,
    type,
    url,
    r2_key,
    is_public,
  });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ message });
}
