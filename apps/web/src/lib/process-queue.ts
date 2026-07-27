import { createServiceClient } from '@fotosposi/core';
import { createMediaRecord, getDriveToken, getEventDriveFolders, updateDriveSyncStatus } from '@fotosposi/media';
import type { EventDriveToken } from '@fotosposi/media';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';
import { applyVideoOverlay } from '@fotosposi/video-overlay';
import { applyOverlay } from '@fotosposi/photo-overlay';
import sharp from 'sharp';
import { watermarkFontFamily } from '@/lib/watermark-fonts';
import { ensureWatermarkFonts, loadBrandLogo } from '@/lib/watermark-fonts.server';

// I glifi dei watermark richiedono font presenti nella lambda (vedi watermark-fonts.ts).
ensureWatermarkFonts();

function getBrandLabel(brand?: string): string {
  return brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
}

/**
 * Aggiorna il token OAuth Google Drive se scaduto usando il refresh_token.
 * - Nessun token / nessun expires_at / non scaduto → ritorna invariato.
 * - Nessun refresh_token → non può refreshare, ritorna invariato (lascia che la
 *   chiamata Drive fallisca con 401, gestita poi dal flow normale).
 * - Refresh fallito → same.
 * - Refresh ok → persiste su `event_drive_tokens` e ritorna il nuovo token.
 * Esportata (e non più come closure interna) per test unitario diretto.
 */
export async function refreshDriveTokenIfExpired(
  eventId: string,
  current: EventDriveToken | undefined,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<EventDriveToken | undefined> {
  if (!current) return current;
  if (!current.expires_at || new Date(current.expires_at).getTime() > Date.now()) return current;
  if (!current.refresh_token) return current;
  const { refreshDriveAccessToken } = await import('@fotosposi/media');
  const refreshed = await refreshDriveAccessToken(current.refresh_token);
  if (!refreshed.access_token) return current;
  const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
  await supabase.from('event_drive_tokens').update({
    access_token: refreshed.access_token,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('event_id', eventId);
  return { ...current, access_token: refreshed.access_token, expires_at: newExpiresAt };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

/**
 * Watermark foto — proxy al modulo `@fotosposi/photo-overlay` (versione "MAX" del 25/07/2026).
 * Mantiene la firma legacy per non toccare i call-site; sotto traduce nei campi
 * `OverlayBranding` attesi dal nuovo modulo.
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
    return await applyOverlay(buffer, {
      format: 'square',
      branding: {
        coupleNames: line1 || '',
        date: line2 || '',
        primaryColor: '#1a1a2e',
        wordmark: getBrandLabel(brand),
        fontFamily,
        brandLogoBuffer: logoPng,
      },
    });
  } catch (err) {
    console.error('applyWatermark overlay fallito:', err);
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

  const tokenResp = await getDriveToken(eventId);
  let token = tokenResp.token;
  const hasDrive = !!token?.access_token;
  let folders: Record<string, string> | null = null;
  if (hasDrive) {
    token = await refreshDriveTokenIfExpired(eventId, token, supabase);
    const f = await getEventDriveFolders(eventId);
    folders = f.folders ?? null;
  }

  let processed = 0;
  for (const item of items) {
    try {
      await supabase.from('upload_queue').update({ status: 'processing' }).eq('id', item.id);

      const r2Key = item.r2_key;
      if (!r2Key) {
        // Irrecuperabile vero: il client non ha mai completato l'upload su R2.
        // retry_count alto = escluso subito dai prossimi sweep invece di consumare i 5 tentativi.
        // (vedi stress test 26/07: molti item con r2_key NULL arrivano qui perché il client
        // ha completato /api/queue action='enqueue' ma è caduto prima della PUT R2.)
        await supabase.from('upload_queue').update({ status: 'failed', error: 'r2_key mancante', retry_count: 99 }).eq('id', item.id);
        continue;
      }
      // Se l'item è marcato 'failed' ma HA un r2_key valido, è un fallimento temporaneo
      // del processing (es. timeout ffmpeg, download R2 interrotto): deve essere ripreso,
      // non marchiato di nuovo failed. reset retry_count così ripartiamo puliti.

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
          // NB: folder_name nel DB è lowercase ('foto'/'video'/...) da ensureDriveFolders.
          const driveFolderId = isVideo ? (folders['video'] || folders['root']) : (folders['foto'] || folders['root']);

          // Google Drive multipart upload richiede `multipart/related` con boundary esplicito:
          // non si può usare `new FormData()` perché (a) in Node 18 runtime il browser
          // FormData non è disponibile, (b) anche su Edge runtime `application/x-www-form-urlencoded`
          // vs `multipart/related` cambia il parsing di Drive API. Costruiamo il body a mano.
          const boundary = `----fotosposi${Date.now().toString(16)}`;
          const metadata: Record<string, unknown> = { name: item.file_name };
          if (driveFolderId) metadata.parents = [driveFolderId];
          const contentType = item.file_type || 'application/octet-stream';
          const metaPart =
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n`;
          const fileHeader =
            `--${boundary}\r\n` +
            `Content-Type: ${contentType}\r\n\r\n`;
          const closing = `\r\n--${boundary}--`;
          const bodyBytes = Buffer.concat([
            Buffer.from(metaPart, 'utf8'),
            Buffer.from(fileHeader, 'utf8'),
            buffer,
            Buffer.from(closing, 'utf8'),
          ]);

          const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2Csize', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token!.access_token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
              'Content-Length': String(bodyBytes.length),
            },
            body: bodyBytes,
            signal: AbortSignal.timeout(30000),
          });
          const driveData = await driveRes.json().catch(() => ({ error: { message: 'JSON parse failed' } }));
          if (driveRes.ok && driveData.id) {
            await updateDriveSyncStatus(media.id, 'synced', driveData.id);
            await supabase.from('upload_queue').update({ status: 'synced', drive_file_id: driveData.id, processed_at: new Date().toISOString() }).eq('id', item.id);
          } else {
            // Bug precedente: status='synced' nonostante Drive sync fallito. Adesso il
            // file placeholder potrebbe mancare di Drive_replica ma lo stato dice la verità
            // e un prossimo cron/sweep può riprovare con retry_count+1.
            await updateDriveSyncStatus(media.id, 'failed');
            await supabase.from('upload_queue').update({ status: 'failed', error: `Drive sync fallito: HTTP ${driveRes.status}`, retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
          }
        } catch (err) {
          await updateDriveSyncStatus(media.id, 'failed');
          await supabase.from('upload_queue').update({ status: 'failed', error: `Drive sync exception: ${(err as Error).message}`, retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
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
