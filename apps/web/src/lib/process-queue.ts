import { createServiceClient } from '@fotosposi/core';
import { createMediaRecord, getDriveToken, getEventDriveFolders, updateDriveSyncStatus } from '@fotosposi/media';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';
import { applyVideoOverlay } from '@fotosposi/video-overlay';
import sharp from 'sharp';
import { ensureWatermarkFonts, watermarkFontFamily, loadBrandLogo } from '@/lib/watermark-fonts';

// I glifi dei watermark richiedono font presenti nella lambda (vedi watermark-fonts.ts).
ensureWatermarkFonts();

function getBrandLabel(brand?: string): string {
  return brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Watermark foto. `line1`/`line2` sono le righe centrali (nomi sposi + data, oppure il
 * testo personalizzato scelto dagli sposi in `events.watermark_text`). Se gli sposi hanno
 * disattivato i nomi (`events.watermark_names = false`) le righe arrivano vuote: niente
 * banda scura, resta impresso solo il logo Sposi.live in basso a destra.
 */
async function applyWatermark(
  buffer: Buffer,
  line1: string,
  line2: string,
  brand?: string,
  fontFamily = 'Playfair Display',
  logoPng?: Buffer | null,
): Promise<Buffer> {
  try {
    const meta = await sharp(buffer).metadata();
    const w = meta.width || 1200;
    const h = meta.height || 900;

    const barHeight = Math.max(160, Math.round(h / 6));
    // Il testo personalizzato può essere lungo ("Ciccia & Ciccio Sposi Palermo 06/07/2026"):
    // riduciamo il font all'aumentare dei caratteri perché resti dentro la larghezza.
    const fontSizeName = Math.min(Math.max(44, Math.round(w / 11)), Math.round((w * 1.6) / Math.max(line1.length, 8)));
    const fontSizeDate = Math.max(32, Math.round(w / 16));
    const fontSizeLogo = Math.max(24, Math.round(w / 22));

    const nameY = h - barHeight + Math.round(barHeight * (line2 ? 0.38 : 0.55));
    const dateY = nameY + fontSizeName + 6;

    const hasBand = !!line1;

    const svgOverlay = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(0,0,0,0.0)" />
          <stop offset="30%" stop-color="rgba(0,0,0,0.5)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0.82)" />
        </linearGradient>
      </defs>
      ${hasBand ? `<rect x="0" y="${h - barHeight}" width="${w}" height="${barHeight}" fill="url(#barGrad)" />
      <text x="${w / 2}" y="${nameY}" text-anchor="middle"
        font-family="${fontFamily}" font-weight="bold" font-size="${fontSizeName}"
        fill="rgba(255,255,255,0.95)">${escapeXml(line1)}</text>` : ''}
      ${hasBand && line2 ? `<text x="${w / 2}" y="${dateY}" text-anchor="middle"
        font-family="${fontFamily}" font-size="${fontSizeDate}"
        fill="rgba(255,255,255,0.85)">${escapeXml(line2)}</text>` : ''}
      ${logoPng ? '' : `<text x="${w - 16}" y="${h - 16}" text-anchor="end"
        font-family="Georgia, serif" font-size="${fontSizeLogo}"
        fill="rgba(255,255,255,0.50)">${getBrandLabel(brand)}</text>`}
    </svg>`;

    const layers: import('sharp').OverlayOptions[] = [{ input: Buffer.from(svgOverlay), top: 0, left: 0 }];
    if (logoPng) {
      // Logo brand in basso a destra al posto del wordmark testuale.
      try {
        const logoH = Math.max(40, Math.round(fontSizeLogo * 2));
        const logo = await sharp(logoPng).resize({ height: logoH }).png().toBuffer();
        const logoMeta = await sharp(logo).metadata();
        layers.push({ input: logo, top: h - logoH - 14, left: w - (logoMeta.width || logoH) - 14 });
      } catch { /* logo illeggibile: watermark senza logo */ }
    }

    return await sharp(buffer)
      .composite(layers)
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
    supabase.from('events').select('couple_name, date, brand, watermark_names, watermark_text, watermark_font').eq('id', eventId).single(),
    supabase
      .from('upload_queue')
      .select('*')
      .eq('event_id', eventId)
      .in('status', ['pending', 'failed'])
      // Massimo 5 tentativi: senza questo filtro un item irrecuperabile (es. "r2_key
      // mancante": il file non è mai arrivato su R2) veniva riprovato all'infinito
      // a ogni sweep, tenendo la coda dell'evento perennemente "in elaborazione".
      .lt('retry_count', 5)
      .order('created_at', { ascending: true })
      .limit(limit),
  ]);

  if (!items || items.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  const coupleName = event?.couple_name || '';
  const eventDate = event?.date ? new Date(event.date).toLocaleDateString('it-IT') : '';
  // Testo impresso su foto/video: se gli sposi hanno disattivato i nomi → righe vuote
  // (resta solo il logo Sposi.live); se hanno scelto un testo personalizzato → quello
  // su una riga sola; altrimenti nomi sposi + data come default.
  const namesEnabled = event?.watermark_names !== false;
  const customText = (event?.watermark_text || '').trim();
  const wmLine1 = !namesEnabled ? '' : (customText || coupleName);
  const wmLine2 = !namesEnabled || customText ? '' : eventDate;
  const wmFont = watermarkFontFamily(event?.watermark_font);
  const brandLogo = loadBrandLogo(event?.brand);

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
        // Irrecuperabile: il client non ha mai completato l'upload su R2. retry_count
        // alto = escluso subito dai prossimi sweep invece di consumare i 5 tentativi.
        await supabase.from('upload_queue').update({ status: 'failed', error: 'r2_key mancante', retry_count: 99 }).eq('id', item.id);
        continue;
      }

      const downloadUrl = await getPresignedDownloadUrl(r2Key, 3600);
      if (!downloadUrl) {
        await supabase.from('upload_queue').update({ status: 'failed', error: 'Download R2 fallito', retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
        continue;
      }

      const resp = await fetch(downloadUrl);
      if (!resp.ok) {
        await supabase.from('upload_queue').update({ status: 'failed', error: 'File su R2 non trovato', retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
        continue;
      }

      const rawArr = await resp.arrayBuffer();
      let buffer = Buffer.from(rawArr) as Buffer;

      const isVideo = item.file_type?.startsWith('video/');
      let contentType = item.file_type || 'application/octet-stream';

      // Watermark: SEMPRE applicato, su TUTTE le foto e TUTTI i video (il logo
      // Sposi.live/JustMarry.live è impresso a prescindere dalle scelte degli sposi);
      // nomi+data o testo personalizzato solo se gli sposi non li hanno disattivati
      // (events.watermark_names / watermark_text).
      if (!isVideo) {
        buffer = await applyWatermark(buffer as Buffer, wmLine1, wmLine2, event?.brand, wmFont, brandLogo);
      } else {
        try {
          const branded = await applyVideoOverlay(buffer as Buffer, {
            branding: {
              coupleNames: wmLine1,
              date: wmLine2,
              primaryColor: '#1a1a2e',
              wordmark: getBrandLabel(event?.brand),
              fontFamily: wmFont,
              logoPng: brandLogo ?? undefined,
            },
            // La route ha maxDuration 300s (Fluid Compute): 240s di clip lasciano
            // margine per download/ri-codifica/upload. Oltre, il video passa
            // originale (caso raro per clip degli invitati).
            maxDurationSeconds: 240,
          });
          if (branded !== buffer) {
            buffer = branded as Buffer;
            contentType = 'video/mp4'; // l'overlay ri-codifica sempre in H.264/AAC MP4
          }
        } catch (overlayErr) {
          // Se ffmpeg fallisce (video corrotto, codec esotico) pubblichiamo comunque
          // il video originale: meglio senza watermark che perso.
          console.error('Video overlay fallito:', overlayErr);
        }
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
        ContentType: contentType,
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
        await supabase.from('upload_queue').update({ status: 'failed', error: recordError || 'Media record fallito', retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
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
