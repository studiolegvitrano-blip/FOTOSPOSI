import { createServiceClient } from '@fotosposi/core';
import { createMediaRecord, getDriveToken, getEventDriveFolders, updateDriveSyncStatus } from '@fotosposi/media';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';
import sharp from 'sharp';

function getBrandFromHost(): string {
  const host = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  if (host.includes('justmarry')) return 'JustMarry.live';
  return 'Sposi.live';
}

async function applyWatermark(
  buffer: Buffer,
  coupleName: string,
  eventDate: string,
): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    const w = meta.width || 1200;
    const h = meta.height || 900;

    const barHeight = Math.max(160, Math.round(h / 6));
    const fontSizeName = Math.max(44, Math.round(w / 11));
    const fontSizeDate = Math.max(32, Math.round(w / 16));
    const fontSizeLogo = Math.max(24, Math.round(w / 22));

    const nameY = h - barHeight + Math.round(barHeight * 0.38);
    const dateY = nameY + fontSizeName + 6;

    const svgOverlay = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(0,0,0,0.0)" />
          <stop offset="30%" stop-color="rgba(0,0,0,0.5)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.82)" />
        </linearGradient>
      </defs>
      <rect x="0" y="${h - barHeight}" width="${w}" height="${barHeight}" fill="url(#barGrad)" />
      <text x="${w / 2}" y="${nameY}" text-anchor="middle"
        font-family="Georgia, serif" font-weight="bold" font-size="${fontSizeName}"
        fill="rgba(255,255,255,0.95)">${coupleName}</text>
      <text x="${w / 2}" y="${dateY}" text-anchor="middle"
        font-family="Georgia, serif" font-size="${fontSizeDate}"
        fill="rgba(255,255,255,0.85)">${eventDate}</text>
      <text x="${w - 16}" y="${h - 16}" text-anchor="end"
        font-family="Georgia, serif" font-size="${fontSizeLogo}"
        fill="rgba(255,255,255,0.50)">${getBrandFromHost()}</text>
    </svg>`;

    return await sharp(buffer)
      .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * Processes up to `limit` pending/failed upload_queue items for a single event: downloads the
 * raw file from R2, watermarks photos, re-uploads, creates the media_uploads record, and syncs
 * to Drive when connected. Shared by the client-triggered route (`/api/r2/process-queue`, called
 * while a guest has the upload page open) and by the autonomous cron sweep
 * (`/api/cron/maintenance`), which is the safety net that keeps processing queues even when
 * nobody has a tab open for that event.
 *
 * Lives outside `app/api/**` (rather than in a route.ts) because Next.js's route type-checker
 * only allows route files to export HTTP method handlers + a small set of config values — any
 * other export (like this function) fails the build with "does not match the required types of
 * a Next.js Route".
 */
export async function processQueueForEvent(eventId: string, limit = 5): Promise<{ processed: number; remaining: number }> {
  const supabase = createServiceClient();

  const [{ data: event }, { data: items }] = await Promise.all([
    supabase.from('events').select('couple_name, date').eq('id', eventId).single(),
    supabase
      .from('upload_queue')
      .select('*')
      .eq('event_id', eventId)
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: true })
      .limit(limit),
  ]);

  if (!items || items.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  const coupleName = event?.couple_name || '';
  const eventDate = event?.date ? new Date(event.date).toLocaleDateString('it-IT') : '';

  const [{ token }] = await Promise.all([getDriveToken(eventId)]);
  const hasDrive = !!token?.access_token;
  let folders: Record<string, string> | null = null;
  if (hasDrive) {
    const f = await getEventDriveFolders(eventId);
    folders = f.folders ?? null;
  }

  let processed = 0;
  for (const item of items) {
    try {
      await supabase.from('upload_queue').update({ status: 'processing' }).eq('id', item.id);

      const r2Key = item.r2_key;
      if (!r2Key) {
        await supabase.from('upload_queue').update({ status: 'failed', error: 'r2_key mancante' }).eq('id', item.id);
        continue;
      }

      const downloadUrl = await getPresignedDownloadUrl(r2Key, 3600);
      if (!downloadUrl) {
        await supabase.from('upload_queue').update({ status: 'failed', error: 'Download R2 fallito' }).eq('id', item.id);
        continue;
      }

      const resp = await fetch(downloadUrl);
      if (!resp.ok) {
        await supabase.from('upload_queue').update({ status: 'failed', error: 'File su R2 non trovato' }).eq('id', item.id);
        continue;
      }

      const rawArr = await resp.arrayBuffer();
      let buffer = Buffer.from(rawArr) as Buffer;

      const isVideo = item.file_type?.startsWith('video/');

      // Watermark solo immagini
      if (!isVideo && coupleName && eventDate) {
        buffer = await applyWatermark(buffer as Buffer, coupleName, eventDate);
      }

      // Ricarica il file watermarked su R2 (sovrascrive l'originale)
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const { S3Client } = await import('@aws-sdk/client-s3');
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
        Body: buffer,
        ContentType: item.file_type || 'application/octet-stream',
      }));

      const { media, error: recordError } = await createMediaRecord({
        event_id: eventId,
        uploaded_by: item.uploaded_by,
        type: isVideo ? 'video' : 'photo',
        url: r2Key,
        compressed: item.compressed ?? false,
        r2_key: r2Key,
      });

      if (recordError || !media) {
        await supabase.from('upload_queue').update({ status: 'failed', error: recordError || 'Media record fallito' }).eq('id', item.id);
        continue;
      }

      if (hasDrive && folders) {
        try {
          const driveFolderId = isVideo ? (folders['Video'] || folders['root']) : (folders['Foto'] || folders['root']);

          const formData = new FormData();
          const blob = new Blob([new Uint8Array(buffer)], { type: item.file_type || 'application/octet-stream' });
          formData.append('file', blob, item.file_name);
          const metadata: Record<string, unknown> = { name: item.file_name };
          if (driveFolderId) metadata.parents = [driveFolderId];
          formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

          const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2Csize', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token.access_token}` },
            body: formData,
            signal: AbortSignal.timeout(15000),
          });
          const driveData = await driveRes.json();
          if (driveRes.ok && driveData.id) {
            await updateDriveSyncStatus(media.id, 'synced', driveData.id);
            await supabase.from('upload_queue').update({ status: 'synced', drive_file_id: driveData.id, processed_at: new Date().toISOString() }).eq('id', item.id);
          } else {
            await updateDriveSyncStatus(media.id, 'failed');
            await supabase.from('upload_queue').update({ status: 'synced', error: 'Drive sync fallito' }).eq('id', item.id);
          }
        } catch {
          await updateDriveSyncStatus(media.id, 'failed');
          await supabase.from('upload_queue').update({ status: 'synced', error: 'Drive sync fallito' }).eq('id', item.id);
        }
      } else {
        await supabase.from('upload_queue').update({ status: 'synced', processed_at: new Date().toISOString() }).eq('id', item.id);
      }
      processed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore';
      await supabase.from('upload_queue').update({ status: 'failed', error: msg, retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
    }
  }

  return { processed, remaining: items.length - processed };
}
