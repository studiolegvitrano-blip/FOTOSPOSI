import { createServiceClient } from '@fotosposi/core';
import { createMediaRecord, getDriveToken, getEventDriveFolders, updateDriveSyncStatus } from '@fotosposi/media';
import type { EventDriveToken } from '@fotosposi/media';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';
import { applyVideoOverlay } from '@fotosposi/video-overlay';
import { applyOverlay, detectWatermark, type WatermarkPresence } from '@fotosposi/photo-overlay';
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
 *
 * IMPORTANTE: se l'overlay fallisce NON ritorniamo più silenziosamente il buffer
 * originale (era il bug che faceva credere all'utente che il watermark non venisse
 * applicato — in realtà sharp andava in catch e noi riscrivevamo l'originale su R2).
 * Ora lanciamo l'errore: il chiamante processQueueForEvent decide se salvare
 * comunque l'originale (per non perdere la foto) oppure marcare failed.
 */
async function applyWatermark(
  buffer: Buffer,
  line1: string,
  line2: string,
  brand?: string,
  fontFamily = 'Playfair Display',
  logoPng?: Buffer | null,
): Promise<Buffer> {
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
    supabase.from('events').select('couple_name, date, brand, watermark_names, watermark_text, watermark_font, groom1_first_name, groom1_last_name, groom2_first_name, groom2_last_name').eq('id', eventId).single(),
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

  // Lookup nome+cognome di chi ha caricato ciascun file (per naming Drive).
  // upload_queue.uploaded_by non ha FK formale verso core_users.id, quindi
  // preleviamo i dati utente in una query separata.
  const uploaderIds = Array.from(new Set((items ?? []).map((i: any) => i.uploaded_by).filter(Boolean)));
  let uploaderMap: Record<string, { first_name?: string; last_name?: string; email?: string }> = {};
  if (uploaderIds.length > 0) {
    const { data: users } = await supabase
      .from('core_users')
      .select('id, first_name, last_name, email')
      .in('id', uploaderIds);
    uploaderMap = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]));
  }

  if (!items || items.length === 0) {
    return { processed: 0, remaining: 0 };
  }

  const coupleName = event?.couple_name || '';
  const eventDate = event?.date ? new Date(event.date).toLocaleDateString('it-IT') : '';
  // Watermark (richiesto dall'utente 27/07/2026):
  //   - SOLO i nomi separati da ❤ (es. "Marco ❤ Luca"), niente data, niente wordmark.
  //   - Priorità: nomi separati groom1/groom2 (compilati dal settings 27/07) →
  //     custom watermark_text → fallback couple_name (legacy).
  //   - Se gli sposi hanno disattivato i nomi (`watermark_names = false`) → stringa vuota.
  const namesEnabled = event?.watermark_names !== false;
  const customText = (event?.watermark_text || '').trim();
  const groom1 = [event?.groom1_first_name, event?.groom1_last_name].filter(Boolean).join(' ').trim();
  const groom2 = [event?.groom2_first_name, event?.groom2_last_name].filter(Boolean).join(' ').trim();
  // Se entrambi i campi groom sono compilati, usa quelli (con cuore). Altrimenti fallback
  // a customText o couple_name.
  let wmLine1 = '';
  if (namesEnabled) {
    if (groom1 && groom2) {
      wmLine1 = `${groom1} ❤ ${groom2}`;
    } else if (customText) {
      wmLine1 = customText;
    } else {
      wmLine1 = coupleName;
    }
  }
  const wmLine2 = ''; // rimossa la data (richiesta utente: solo nomi)
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
      // nomi separati solo se gli sposi non li hanno disattivati
      // (events.watermark_names). vedi `wmLine1/wmLine2` sopra per i dettagli.
      if (!isVideo) {
        try {
          buffer = await applyWatermark(buffer as Buffer, wmLine1, wmLine2, event?.brand, wmFont, brandLogo);
        } catch (watermarkErr) {
          // Bug fix 27/07/2026: prima applyWatermark aveva un catch silente che
          // restituiva il buffer originale (l'utente vedeva foto senza watermark
          // senza capire perché). Ora l'errore viene loggato esplicitamente e la
          // foto viene comunque salvata su R2 (meglio senza watermark che persa),
          // ma il log permette di diagnosticare la vera causa (sharp/fonte/lambda).
          console.error(`[process-queue] watermark foto fallito per ${item.file_name} (event=${eventId}):`, watermarkErr);
        }
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

      // ── Self-healing check: verifica che applyOverlay abbia EFFETTIVAMENTE
      // scritto il watermark sul file appena caricato su R2. Se manca →
      // log diagnostico e status='failed' (così l'utente vede il problema
      // invece di credere che il watermark sia ok). La foto resta su R2
      // e in galleria (meglio senza logo che persa) ma il flag failed
      // permette a un cron successivo di ritentare. ──
      let watermarkMissing = false;
      if (!isVideo) {
        try {
          const verifyUrl = await getPresignedDownloadUrl(r2Key, 3600);
          if (verifyUrl) {
            const verifyResp = await fetch(verifyUrl);
            if (verifyResp.ok) {
              const verifyBuf = Buffer.from(await verifyResp.arrayBuffer());
              const presence: WatermarkPresence = await detectWatermark(verifyBuf);
              // La foto ha il watermark SOLO se è stato richiesto (wmLine1 != '' oppure c'è un logo).
              const expectsWatermark = !!wmLine1 || !!brandLogo;
              if (expectsWatermark && !presence.hasLogo && presence.confidence < 0.3) {
                watermarkMissing = true;
                console.error(
                  `[process-queue] WATERMARK MANCANTE su ${item.file_name} (event=${eventId}): ` +
                  `presence=${JSON.stringify(presence)} — applyOverlay probabilmente fallito in silenzio.`,
                );
              } else {
                console.log(
                  `[process-queue] watermark OK su ${item.file_name}: confidence=${presence.confidence.toFixed(2)} ` +
                  `(logo=${presence.hasLogo}, names=${presence.hasNames})`,
                );
              }
            }
          }
        } catch (verifyErr) {
          // Non bloccare: la verifica è best-effort, se R2 è giù ci fidiamo dell'upload.
          console.warn('[process-queue] detectWatermark verify fallita:', verifyErr instanceof Error ? verifyErr.message : verifyErr);
        }
      }

      const { media, error: recordError } = await createMediaRecord({
        event_id: eventId,
        uploaded_by: item.uploaded_by,
        type: isVideo ? 'video' : 'photo',
        url: r2Key,
        compressed: item.compressed ?? false,
        r2_key: r2Key,
        watermark_missing: watermarkMissing || undefined,
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
          // Naming convention Drive (richiesto 27/07/2026): i file arrivano come
          //   "AAAA_MM_GG_HH_MM_SS_NOME_COGNOME_<originalName>"
          // Dove NOME_COGNOME è di chi ha caricato il file (leggo da core_users).
          // Esempio: "20260727_143015_Giuseppe_Vitrano_DSC_0001.jpg"
          const uploader = uploaderMap[item.uploaded_by];
          const uploaderName = [uploader?.first_name, uploader?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim()
            .replace(/\s+/g, '_')
            // Rimuovi caratteri non ammessi in Drive: / \ ? % * : | " < >
            .replace(/[\/\\?%*:|"<>]/g, '')
            || (uploader?.email ? uploader.email.split('@')[0] : 'Anonimo');
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const datePrefix = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
          const safeOriginal = (item.file_name || 'file').replace(/[\/\\?%*:|"<>]/g, '_');
          const driveName = `${datePrefix}_${uploaderName}_${safeOriginal}`;
          const metadata: Record<string, unknown> = { name: driveName };
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
            // Watermark mancante ha priorità sul successo Drive: l'utente vede il flag.
            const finalStatus = watermarkMissing ? 'failed' : 'synced';
            const finalError = watermarkMissing ? 'Watermark non applicato (rilevato da detectWatermark)' : null;
            await supabase.from('upload_queue').update({
              status: finalStatus,
              drive_file_id: driveData.id,
              processed_at: watermarkMissing ? null : new Date().toISOString(),
              error: finalError,
              retry_count: watermarkMissing ? (item.retry_count || 0) + 1 : item.retry_count || 0,
            }).eq('id', item.id);
          } else {
            // Bug precedente: status='synced' nonostante Drive sync fallito. Adesso il
            // file placeholder potrebbe mancare di Drive_replica ma lo stato dice la verità
            // e un prossimo cron/sweep può riprovare con retry_count+1.
            await updateDriveSyncStatus(media.id, 'failed');
            const driveError = `Drive sync fallito: HTTP ${driveRes.status}`;
            const compositeError = watermarkMissing ? `Watermark mancante + ${driveError}` : driveError;
            await supabase.from('upload_queue').update({ status: 'failed', error: compositeError, retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
          }
        } catch (err) {
          await updateDriveSyncStatus(media.id, 'failed');
          const driveErr = `Drive sync exception: ${(err as Error).message}`;
          const compositeError = watermarkMissing ? `Watermark mancante + ${driveErr}` : driveErr;
          await supabase.from('upload_queue').update({ status: 'failed', error: compositeError, retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
        }
      } else {
        // Nessun Drive: lo status è guidato solo da watermarkMissing.
        if (watermarkMissing) {
          await supabase.from('upload_queue').update({ status: 'failed', error: 'Watermark non applicato (rilevato da detectWatermark)', retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
        } else {
          await supabase.from('upload_queue').update({ status: 'synced', processed_at: new Date().toISOString() }).eq('id', item.id);
        }
      }
      processed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore';
      await supabase.from('upload_queue').update({ status: 'failed', error: msg, retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
    }
  }

  return { processed, remaining: items.length - processed };
}

/**
 * Helper one-shot: ri-applica il watermark a tutte le foto di un evento
 * già caricate su R2 con `media_uploads.watermark_missing = true` (foto
 * processate prima del fix del 28/07/2026, o dove applyOverlay è caduto
 * silenziosamente). NON è un cron: l'utente deve invocarlo esplicitamente
 * quando sa che le foto del bug-sessione vanno ri-processate.
 *
 * Strategia (diversa da processQueueForEvent):
 *   - NON legge da upload_queue (quegli item sono già 'synced' o non
 *     esistono più): legge direttamente da media_uploads filtering per
 *     `watermark_missing = true AND event_id = ?`.
 *   - Per ogni record: download R2 → applyWatermark → upload R2 (stessa r2_key)
 *     → update media_uploads.watermark_missing = false.
 *   - NON tocca upload_queue né drive_sync_status (preserva lo stato esistente).
 *
 * È limitato (default 50 foto per run) per evitare timeout lambda.
 */
export async function repairWatermarkForEvent(
  eventId: string,
  limit = 50,
): Promise<{ repaired: number; skipped: number; errors: string[] }> {
  const supabase = createServiceClient();
  const errors: string[] = [];

  const [{ data: event }, { data: media }] = await Promise.all([
    supabase.from('events').select('couple_name, date, brand, watermark_names, watermark_text, watermark_font, groom1_first_name, groom1_last_name, groom2_first_name, groom2_last_name').eq('id', eventId).single(),
    supabase
      .from('media_uploads')
      .select('id, r2_key, uploaded_by, type')
      .eq('event_id', eventId)
      .eq('watermark_missing', true)
      .eq('type', 'photo')
      .order('created_at', { ascending: true })
      .limit(limit),
  ]);

  if (!media || media.length === 0) {
    return { repaired: 0, skipped: 0, errors };
  }

  // Composizione watermark (stessa logica di processQueueForEvent — duplicata
  // per evitare refactoring espansivo: questa funzione è one-shot).
  const namesEnabled = event?.watermark_names !== false;
  const customText = (event?.watermark_text || '').trim();
  const groom1 = [event?.groom1_first_name, event?.groom1_last_name].filter(Boolean).join(' ').trim();
  const groom2 = [event?.groom2_first_name, event?.groom2_last_name].filter(Boolean).join(' ').trim();
  let wmLine1 = '';
  if (namesEnabled) {
    if (groom1 && groom2) wmLine1 = `${groom1} ❤ ${groom2}`;
    else if (customText) wmLine1 = customText;
    else wmLine1 = event?.couple_name || '';
  }
  const wmFont = watermarkFontFamily(event?.watermark_font);
  const brandLogo = loadBrandLogo(event?.brand);

  let repaired = 0;
  let skipped = 0;

  for (const m of media) {
    const r2Key = m.r2_key;
    if (!r2Key) {
      skipped++;
      errors.push(`media ${m.id}: r2_key mancante`);
      continue;
    }
    try {
      const downloadUrl = await getPresignedDownloadUrl(r2Key, 3600);
      if (!downloadUrl) { skipped++; errors.push(`media ${m.id}: presigned fallito`); continue; }
      const resp = await fetch(downloadUrl);
      if (!resp.ok) { skipped++; errors.push(`media ${m.id}: download HTTP ${resp.status}`); continue; }
      const buffer = Buffer.from(await resp.arrayBuffer()) as Buffer;

      let watermarked: Buffer = buffer;
      try {
        watermarked = await applyWatermark(buffer, wmLine1, '', event?.brand, wmFont, brandLogo);
      } catch (wmErr) {
        // Verifica post-fix: l'errore ora è loud (non più silente). Logghiamo ma
        // non marchiamo il record come repaired: rimarrà watermark_missing=true.
        console.error(`[repairWatermark] fallito su media ${m.id}:`, wmErr);
        skipped++; errors.push(`media ${m.id}: ${wmErr instanceof Error ? wmErr.message : 'errore watermark'}`);
        continue;
      }

      // Ricarica su R2 (stessa key = sovrascrive l'originale non watermarkato).
      const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
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
        Body: watermarked,
        ContentType: 'image/jpeg',
      }));

      // Verifica post-upload: detectWatermark check (ricavato come in processQueueForEvent).
      let verifiedOk = false;
      try {
        const verifyUrl = await getPresignedDownloadUrl(r2Key, 3600);
        if (verifyUrl) {
          const vResp = await fetch(verifyUrl);
          if (vResp.ok) {
            const vBuf = Buffer.from(await vResp.arrayBuffer());
            const presence = await detectWatermark(vBuf);
            verifiedOk = presence.hasLogo || presence.confidence > 0.3;
          }
        }
      } catch {
        // Verifica best-effort: se R2 giù, ci fidiamo dell'upload.
        verifiedOk = true;
      }

      if (verifiedOk) {
        await supabase.from('media_uploads').update({ watermark_missing: false }).eq('id', m.id);
        repaired++;
      } else {
        skipped++;
        errors.push(`media ${m.id}: watermark ancora assente dopo repair`);
      }
    } catch (err) {
      skipped++;
      errors.push(`media ${m.id}: ${err instanceof Error ? err.message : 'errore generico'}`);
    }
  }

  return { repaired, skipped, errors };
}
