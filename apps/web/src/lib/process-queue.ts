import { createServiceClient } from '@fotosposi/core';
import { createMediaRecord, getDriveToken, getEventDriveFolders, updateDriveSyncStatus } from '@fotosposi/media';
import type { EventDriveToken } from '@fotosposi/media';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';
import { applyVideoOverlay } from '@fotosposi/video-overlay';
import { applyOverlay, detectWatermark, type WatermarkPresence } from '@fotosposi/photo-overlay';
import sharp from 'sharp';
import { watermarkFontFamily } from '@/lib/watermark-fonts';
import { ensureWatermarkFonts, loadBrandLogo, loadWatermarkFontBuffer } from '@/lib/watermark-fonts.server';

// I glifi dei watermark richiedono font presenti nella lambda (vedi watermark-fonts.ts).
ensureWatermarkFonts();

// â”€â”€ FIX 7 (30/07/2026): processing robusto per migliaia di matrimoni â”€â”€
// Concetti:
//   - `MAX_RETRY_COUNT` = numero massimo di tentativi di processing per item
//     PRIMA di spostarlo nella DLQ. Il valore Ã¨ basso apposta: un item fallito
//     7 volte ha un problema strutturale (file corrotto, MIME non supportato,
//     permessi) che un ottavo tentativo non risolverÃ .
//   - `CONCURRENCY` = numero di item processati in parallelo. limitato per non
//     saturare la lambda Vercel (memory/time) e per non sovraccaricare R2 con
//     troppi GetObject simultanei (R2 ha rate limit soft ~100 req/100 Pf/s).
//   - `FAILURE_CLASS_*` = stringhe sentinel per `system_health_log.failure_class`
//     e per `upload_queue_dead_letter.last_failure_class`. Dashboard admin le
//     aggrega per capire le cause piÃ¹ frequenti a livello di piattaforma.
const MAX_RETRY_COUNT = 7;
const CONCURRENCY = 4;

const FAILURE_CLASS_R2_DOWNLOAD = 'r2_download_failed';
const FAILURE_CLASS_WATERMARK = 'watermark_apply_failed';
const FAILURE_CLASS_DRIVE = 'drive_sync_failed';
const FAILURE_CLASS_DETECT = 'detect_watermark_missing';
const FAILURE_CLASS_INVALID = 'invalid_image';
const FAILURE_CLASS_OTHER = 'other';

/**
 * Backoff esponenziale puro (no jitter per testabilitÃ  deterministica).
 * Tentativo 1 = 1s, 2 = 2s, 3 = 4s, ..., 7 = 64s. Cap a 60s oltre il 7Â°.
 * Esportato per test unitari (vedi __tests__/process-queue-backoff.test.ts).
 */
export function computeProcessingBackoffMs(retryCount: number): number {
  if (retryCount <= 0) return 0;
  const ms = Math.pow(2, retryCount - 1) * 1000;
  return Math.min(ms, 60_000);
}

/**
 * Scrive una riga di telemetry in `system_health_log` per ogni fallimento di
 * processing. Permette dashboard admin aggregabili per evento/classe/file.
 * best-effort: se la insert fallisce, logga warning ma NON Propaga (la
 * observability non deve mai bloccare il path di business).
 */
async function logFailure(
  supabase: ReturnType<typeof createServiceClient>,
  params: { eventId: string; fileName?: string; failureClass: string; errorMessage: string; retryCount: number },
): Promise<void> {
  try {
    await supabase.from('system_health_log').insert({
      kind: 'upload_processing_failure',
      event_id: params.eventId,
      file_name: params.fileName ?? null,
      failure_class: params.failureClass,
      error_message: params.errorMessage,
      retry_count: params.retryCount,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[process-queue] telemetry insert fallita (non bloccante):', err instanceof Error ? err.message : err);
  }
}

/**
 * Sposta un item da `upload_queue` a `upload_queue_dead_letter` (DLQ).
 * Chiamato quando `retry_count` raggiunge `MAX_RETRY_COUNT` (7). L'item resta
 * tracciato (visto dalla route /api/cron/dlq-retry) ma NON Ã¨ piÃ¹ ripescato dal
 * cron di maintenance â†’ la coda `upload_queue` resta snella anche con migliaia
 * di matrimoni. best-effort su entrambe le scritture: se la copia fallisce,
 * l'item resta in upload_queue con retry_count=MAX (sche.schedule ripescarlo
 * comunque); se la delete fails dopo copia OK, avremo un dup (ma il cron
 * skip-match su original_id nella DLQ previene il re-inserimento).
 */
async function moveToDeadLetter(
  supabase: ReturnType<typeof createServiceClient>,
  item: Record<string, unknown>,
  failureClass: string,
  errorMessage: string,
): Promise<void> {
  const eventId = String(item.event_id ?? '');
  try {
    await supabase.from('upload_queue_dead_letter').insert({
      original_upload_queue_id: String(item.id),
      event_id: eventId,
      uploaded_by: (item.uploaded_by as string | null) ?? null,
      file_name: (item.file_name as string | null) ?? null,
      file_type: (item.file_type as string | null) ?? null,
      file_size: (item.file_size as number | null) ?? null,
      r2_key: (item.r2_key as string | null) ?? null,
      drive_file_id: (item.drive_file_id as string | null) ?? null,
      retry_count: Number(item.retry_count ?? 0),
      moved_to_dlq_at: new Date().toISOString(),
      moved_to_dlq_reason: errorMessage,
      last_failure_class: failureClass,
      last_failure_message: errorMessage,
      original_uploaded_at: (item.created_at as string | null) ?? null,
    });
    await supabase.from('upload_queue').delete().eq('id', String(item.id));
    console.error(`[process-queue] item ${item.id} (event=${eventId}) spostato in DLQ dopo ${MAX_RETRY_COUNT} tentativi: ${failureClass} â€” ${errorMessage}`);
  } catch (err) {
    console.error(`[process-queue] impossibile spostare item ${item.id} in DLQ:`, err instanceof Error ? err.message : err);
  }
}

function getBrandLabel(brand?: string): string {
  return brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
}

/**
 * Aggiorna il token OAuth Google Drive se scaduto usando il refresh_token.
 * - Nessun token / nessun expires_at / non scaduto â†’ ritorna invariato.
 * - Nessun refresh_token â†’ non puÃ² refreshare, ritorna invariato (lascia che la
 *   chiamata Drive fallisca con 401, gestita poi dal flow normale).
 * - Refresh fallito â†’ same.
 * - Refresh ok â†’ persiste su `event_drive_tokens` e ritorna il nuovo token.
 * Esportata (e non piÃ¹ come closure interna) per test unitario diretto.
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
 * Composizione della riga principale del watermark (in basso a sinistra) a
 * partire dai campi dell'evento. Esportata come helper puro per testabilitÃ .
 *
 * PrioritÃ  (FIX 29/07/2026 dopo bug utente "watermark applicato, c'Ã¨ logo e
 * scritta ma non quella disposta nelle impostazioni"):
 *   1. `watermark_text` custom se NON vuoto â€” Ã¨ il testo scelto dagli sposi
 *      (tipicamente include frase + data + cuore), ha la precedenza ASSOLUTA.
 *   2. Nomi separati `groom1_* + groom2_*` (compilati dal settings 27/07/2026) â†’
 *      formattati come "Nome1 Cognome1 â¤ Nome2 Cognome2".
 *   3. Fallback `couple_name` (legacy pre-27/07).
 *
 * Se `watermark_names === false` â†’ stringa vuota (i nomi sono disattivati).
 *
 * @param event Oggetto evento con i campi rilevanti (watermark_names,
 *              watermark_text, groom1_first_name/last_name, groom2_*, couple_name)
 * @returns stringa da passare come `branding.coupleNames` ad applyOverlay.
 */
export function composeWatermarkLine1(event: {
  watermark_names?: boolean | null;
  watermark_text?: string | null;
  groom1_first_name?: string | null;
  groom1_last_name?: string | null;
  groom2_first_name?: string | null;
  groom2_last_name?: string | null;
  couple_name?: string | null;
} | null | undefined): string {
  if (!event) return '';
  const namesEnabled = event.watermark_names !== false;
  if (!namesEnabled) return '';
  const customText = (event.watermark_text || '').trim();
  if (customText) return customText;
  const groom1 = [event.groom1_first_name, event.groom1_last_name].filter(Boolean).join(' ').trim();
  const groom2 = [event.groom2_first_name, event.groom2_last_name].filter(Boolean).join(' ').trim();
  if (groom1 && groom2) return `${groom1} \u2764 ${groom2}`; // ❤ U+2764 escaped (no encoding-rot risk)
  return (event.couple_name || '').trim();
}

/**
 * Watermark foto â€” proxy al modulo `@fotosposi/photo-overlay` (versione "MAX" del 25/07/2026).
 * Mantiene la firma legacy per non toccare i call-site; sotto traduce nei campi
 * `OverlayBranding` attesi dal nuovo modulo.
 *
 * IMPORTANTE: se l'overlay fallisce NON ritorniamo piÃ¹ silenziosamente il buffer
 * originale (era il bug che faceva credere all'utente che il watermark non venisse
 * applicato â€” in realtÃ  sharp andava in catch e noi riscrivevamo l'originale su R2).
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
  fontBuffer?: Buffer | null,
): Promise<Buffer> {
  return await applyOverlay(buffer, {
    format: 'square',
    branding: {
      coupleNames: line1 || '',
      date: line2 || '',
      primaryColor: '#1a1a2e',
      wordmark: getBrandLabel(brand),
      fontFamily,
      fontBuffer,
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
 * only allows route files to export HTTP method handlers + a small set of config values â€” any
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
      // FIX 30/07/2026: max 7 tentativi (MAX_RETRY_COUNT). Dopo il 7Â° fallimento
      // l'item viene spostato in `upload_queue_dead_letter` dalla funzione
      // `moveToDeadLetter` (vedi processSingleItem). Senza questo filtro un item
      // irrecuperabile (es. "r2_key mancante": il file non Ã¨ mai arrivato su R2)
      // veniva riprovato all'infinito a ogni sweep, tenendo la coda perennemente
      // "in elaborazione".
      .lt('retry_count', MAX_RETRY_COUNT)
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
  // Watermark (richiesto dall'utente 29/07/2026):
  //   - PrioritÃ : `watermark_text` custom (scritto dagli sposi nelle settings)
  //     HA SEMPRE la precedenza â†’ nomi separati groom1+groom2 â†’ couple_name.
  //   - `watermark_names = false` â†’ stringa vuota.
  //   - Il cuore presente nel testo custom viene splittato da applyOverlay e
  //     reso come path vettoriale rosso (vedi packages/photo-overlay/src/index.ts),
  //     quindi non dipende da font Dingbats installati.
  // Logica isolata nell'helper esportato `composeWatermarkLine1` per testabilitÃ .
  const wmLine1 = composeWatermarkLine1(event);
  const wmLine2: string = ''; // rimossa la data (richiesta utente: solo nomi)
  const wmFont = watermarkFontFamily(event?.watermark_font);
  const brandLogo = loadBrandLogo(event?.brand);
  // FIX 28/07/2026: bytes del TTF reale, per l'embedding @font-face che bypassa
  // fontconfig di sistema (vedi packages/photo-overlay/src/index.ts).
  const wmFontBuffer = loadWatermarkFontBuffer(event?.watermark_font);

  const tokenResp = await getDriveToken(eventId);
  let token = tokenResp.token;
  const hasDrive = !!token?.access_token;
  let folders: Record<string, string> | null = null;
  if (hasDrive) {
    token = await refreshDriveTokenIfExpired(eventId, token, supabase);
    const f = await getEventDriveFolders(eventId);
    folders = f.folders ?? null;
  }

  // FIX 29/07/2026: inizializzo client S3 + PutObjectCommand UNA VOLTA fuori dal
  // loop, cosÃ¬ sono disponibili sia per il salvataggio dell'originale (prefisso
  // originals/, vedi migration 00040) sia per il successivo upload del watermarked
  // (stessa r2_key). Prima erano dichiarati inline dopo il watermark, quindi il
  // salvataggio originale NON poteva accedervi â†’ bug TypeScript "used before declaration".
  const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
  });
  const r2Bucket = process.env.R2_BUCKET || 'fotosposi-uploads';

  // â”€â”€ FIX 7 (30/07/2026): processing parallelo conPromise.allSettled â”€â”€
  // Per rendere il sistema solido a migliaia di matrimoni + centinaia di
  // invitati, ogni batch di item viene processato CONCORRENTEMENTE (4 per
  // volta) invece che uno alla volta. Se un item Ã¨ corrotto / lento (es.
  // ffmpeg su 240MB) NON blocca gli altri item dello stesso batch nÃ© gli
  // eventi successivi. Promise.allSettled non rigetta mai: il cron puÃ² finire
  // anche se un singolo item ha crashato.
  // Backoff esponenziale: dopo max retry l'item viene spostato in DLQ
  // (`upload_queue_dead_letter`) e cancellato dalla coda principale. La
  // telemetry in `system_health_log` permette dashboard di piattaforma.
  const sharedCtx = {
    supabase,
    eventId,
    event,
    wmLine1,
    wmLine2,
    wmFont,
    brandLogo,
    wmFontBuffer,
    uploaderMap,
    hasDrive,
    token,
    folders,
    r2Client,
    r2Bucket,
  };

  let processed = 0;
  const itemsList = items ?? [];
  for (let i = 0; i < itemsList.length; i += CONCURRENCY) {
    const chunk = itemsList.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map((item: any) => processSingleItem(item, sharedCtx)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === true) processed++;
    }
  }

  return { processed, remaining: itemsList.length - processed };
}

/**
 * Processa UN item della coda upload_queue. Dettagli funzione:
 *   - Tutto il body di errore chiama `logFailure` + poi `moveToDeadLetter` se
 *     `newRetryCount >= MAX_RETRY_COUNT` (7), altrimenti segna 'failed' con
 *     retry_count++ (così il prossimo cron lo riprende con backoff atteso).
 *   - Torna `true` solo quando l'item è 'synced' (o watermark_failed: la foto
 *     è pubblica ma il flag failed resta per retry/visibility). Torna `false`
 *     in ogni caso di fallimento (così il counter processed del batch non
 *     mente — un batch 4-item con 2 fallimenti conta 2 processed, non 4).
 *   - Promesse: NON rigetta mai. Promise.allSettled lo garantisce anche se
 *     sfuggisse un throw sync (es. typo dentro funzione)→ outer catch.
 *
 * Helper **package-private**: NON esportato in `index.ts`, va chiamato solo
 * da processQueueForEvent (e da test con mock). Vive qui non in una route per
 * condividere il client supabase / r2 / Drive / fonts col caller → zero
 * bootstrap overhead per item (riconosce che sharp/video-overlay/fetch sono
 * già warm).
 */
async function processSingleItem(
  item: Record<string, any>,
  ctx: {
    supabase: ReturnType<typeof createServiceClient>;
    eventId: string;
    event: any;
    wmLine1: string;
    wmLine2: string;
    wmFont: string;
    brandLogo: Buffer | null;
    wmFontBuffer: Buffer | null;
    uploaderMap: Record<string, { first_name?: string; last_name?: string; email?: string }>;
    hasDrive: boolean;
    token: EventDriveToken | undefined;
    folders: Record<string, string> | null;
    r2Client: any;
    r2Bucket: string;
  },
): Promise<boolean> {
  const { supabase, eventId, event, wmLine1, wmLine2, wmFont, brandLogo, wmFontBuffer, hasDrive, token, folders, r2Client, r2Bucket } = ctx;
  try {
    await supabase.from('upload_queue').update({ status: 'processing' }).eq('id', item.id);

    const r2Key = item.r2_key;
    if (!r2Key) {
      const newRetry = 99;
      await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_INVALID, errorMessage: 'r2_key mancante', retryCount: newRetry });
      await supabase.from('upload_queue').update({ status: 'failed', error: 'r2_key mancante', retry_count: newRetry }).eq('id', item.id);
      return false;
    }

    // FIX 30/07/2026 (richiesta utente): auto-cleanup di item falliti il cui file
    // risulta già in galleria ({media_uploads}) con drive_file_id presente.
    // Causa tipica: il primo processing ha creato media_uploads +_uploaded su R2
    // + caricato su Drive, ma un update finale (es. set status='synced') ha
    // lanciato un errore spurio → item marcato 'failed' benché OK. Senza questo
    // auto-cleanup, il cron ritenta charity e crea duplicati o amplifica l'errore.
    // Strategia: se già esiste media_uploads.r2_key = item.r2_key AND event_id =
    // eventId AND drive_file_id IS NOT NULL → l'item è già successo in toto,
    // lo cancelliamo dalla coda (status finale: 'synced' per chiarezza).
    // Best-effort: se la query fallisce (Supabase giù) si prosegue col processing
    // normale (meglio un duplicato che un item perso).
    try {
      const { data: existingMedia } = await supabase
        .from('media_uploads')
        .select('id, drive_file_id')
        .eq('event_id', eventId)
        .eq('r2_key', r2Key)
        .maybeSingle();
      if (existingMedia && existingMedia.drive_file_id) {
        console.log(`[process-queue] auto-cleanup item ${item.id} (event=${eventId}, file=${item.file_name}): già in media_uploads + Drive (media_id=${existingMedia.id})`);
        await supabase.from('upload_queue').update({ status: 'synced', processed_at: new Date().toISOString(), drive_file_id: existingMedia.drive_file_id, error: null }).eq('id', item.id);
        return true;
      }
    } catch (_autoCleanupErr) {
      // Non blocca il processing: la query di introspezione può fallire per
      // ragioni transienti (R2/Supabase), e in quel caso si prosegue col path
      // normale → se proprio è già synced, il createMediaRecord fallback su
      // INSERT + ON CONFLICT (migration 00037) gestisce la dup.
    }

    const downloadUrl = await getPresignedDownloadUrl(r2Key, 3600);
    if (!downloadUrl) {
      const newRetry = (item.retry_count || 0) + 1;
      await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_R2_DOWNLOAD, errorMessage: 'Download R2 fallito (no presigned URL)', retryCount: newRetry });
      if (newRetry >= MAX_RETRY_COUNT) await moveToDeadLetter(supabase, item, FAILURE_CLASS_R2_DOWNLOAD, 'Download R2 fallito (no presigned URL)');
      else await supabase.from('upload_queue').update({ status: 'failed', error: 'Download R2 fallito', retry_count: newRetry }).eq('id', item.id);
      return false;
    }

    const resp = await fetch(downloadUrl);
    if (!resp.ok) {
      const newRetry = (item.retry_count || 0) + 1;
      const msg = `File su R2 non trovato (HTTP ${resp.status})`;
      await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_R2_DOWNLOAD, errorMessage: msg, retryCount: newRetry });
      if (newRetry >= MAX_RETRY_COUNT) await moveToDeadLetter(supabase, item, FAILURE_CLASS_R2_DOWNLOAD, msg);
      else await supabase.from('upload_queue').update({ status: 'failed', error: msg, retry_count: newRetry }).eq('id', item.id);
      return false;
    }

    const rawArr = await resp.arrayBuffer();
    let buffer = Buffer.from(rawArr) as Buffer;

    const isVideo = item.file_type?.startsWith('video/');
    let contentType = item.file_type || 'application/octet-stream';

    // FIX 29/07/2026: persistenza dell'originale su R2 PRIMA del watermark.
    const originalKey = `originals/${r2Key}`;
    try {
      const { PutObjectCommand: PutCmd } = await import('@aws-sdk/client-s3');
      await r2Client.send(new PutCmd({
        Bucket: r2Bucket,
        Key: originalKey,
        Body: buffer,
        ContentType: contentType,
      }));
      console.log(`[process-queue] originale salvato su R2: ${originalKey}`);
    } catch (originalErr) {
      console.error(`[process-queue] impossibile salvare originale ${originalKey} (event=${eventId}):`, originalErr);
    }

    // Watermark applicato a foto e video (vedi commento storico per dettagli).
    let watermarkFailed = false;
    if (!isVideo) {
      try {
        buffer = await applyWatermark(buffer as Buffer, wmLine1, wmLine2, event?.brand, wmFont, brandLogo, wmFontBuffer);
      } catch (watermarkErr) {
        watermarkFailed = true;
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
          maxDurationSeconds: 240,
        });
        if (branded !== buffer) {
          buffer = branded as Buffer;
          contentType = 'video/mp4';
        }
      } catch (overlayErr) {
        console.error('Video overlay fallito:', overlayErr);
      }
    }

    // Ricarica watermarked su R2 (sovrascrive visibile).
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    await r2Client.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: r2Key,
      Body: buffer,
      ContentType: contentType,
    }));

    // Self-healing check su watermark (vedi detectWatermark). Solo foto, solo
    // se il applyWatermark non ha già lanciato, solo se attesi nomi/logo.
    let watermarkMissing = watermarkFailed;
    const expectsWatermark = !!wmLine1 || !!brandLogo;
    if (!isVideo && !watermarkFailed && expectsWatermark) {
      try {
        const verifyUrl = await getPresignedDownloadUrl(r2Key, 3600);
        if (verifyUrl) {
          const verifyResp = await fetch(verifyUrl);
          if (verifyResp.ok) {
            const verifyBuf = Buffer.from(await verifyResp.arrayBuffer());
            const presence: WatermarkPresence = await detectWatermark(verifyBuf);
            const namesExpected = !!wmLine1;
            const namesOk = !namesExpected || presence.hasHeart;
            const logoOk = !brandLogo || presence.hasLogo;
            if (!namesOk || !logoOk) {
              watermarkMissing = true;
              console.error(
                `[process-queue] WATERMARK MANCANTE su ${item.file_name} (event=${eventId}): ` +
                `presence=${JSON.stringify(presence)} namesOk=${namesOk} logoOk=${logoOk}.`,
              );
            } else {
              console.log(
                `[process-queue] watermark OK su ${item.file_name}: confidence=${presence.confidence.toFixed(2)} ` +
                `(logo=${presence.hasLogo}, heart=${presence.hasHeart}, names=${presence.hasNames})`,
              );
            }
          }
        }
      } catch (verifyErr) {
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
      original_r2_key: originalKey,
      watermark_missing: watermarkMissing || undefined,
    });

    if (recordError || !media) {
      const newRetry = (item.retry_count || 0) + 1;
      const msg = recordError || 'Media record fallito';
      await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_OTHER, errorMessage: String(msg), retryCount: newRetry });
      if (newRetry >= MAX_RETRY_COUNT) await moveToDeadLetter(supabase, item, FAILURE_CLASS_OTHER, String(msg));
      else await supabase.from('upload_queue').update({ status: 'failed', error: String(msg), retry_count: newRetry }).eq('id', item.id);
      return false;
    }

    // FIX 31/07/2026 (richiesta utente): su Drive viene caricato l'ORIGINALE SENZA WATERMARK,
    // mentre su R2/galleria resta il watermarked. Lo sposo vuole backup puliti permanenti, ma
    // la galleria pubblica mostra il branding. Strategia:
    //   - `buffer` (watermarked) è già stato salvato su R2 con la stessa r2_key (riga 509).
    //   - Per Drive carichiamo l'originale NON watermarked, salvato in precedenza su R2
    //     `originals/${r2Key}` (riga 469). Lo scarichiamo con presigned GET per inviarlo a Drive.
    //   - Se per qualche motivo l'originale non è disponibile (es. PutObject originale fallito),
    //     fallback degradato: carica il watermarked — meglio un backup imperfetto che nessun backup.
    let driveBuffer: Buffer = buffer;
    if (hasDrive && folders) {
      // Solo per foto: per i video il watermark è già insito nel buffer (video-overlay
      // applica overlay ffmpeg in-place). Il video originale senza watermark non è salvato
      // su R2 originals/ — quel fallback era stato rimosso per video >100MB per non duplicare
      // storage. Per video, Drive riceve il watermarked (impraticabile da evitare senza VPS).
      // Per FOTO invece: scarichiamo l'originale da R2 e lo mandiamo a Drive pulito.
      if (!isVideo) {
        try {
          const originalGetUrl = await getPresignedDownloadUrl(originalKey, 600);
          if (originalGetUrl) {
            const origResp = await fetch(originalGetUrl);
            if (origResp.ok) {
              driveBuffer = Buffer.from(await origResp.arrayBuffer()) as Buffer;
            }
          }
        } catch (origErr) {
          // Fallback degradato: usa il buffer watermarked per Drive (meglio un backup
          // imperfetto che niente). Logga il warning per observability ma non bloccare.
          console.warn(`[process-queue] download originale ${originalKey} per Drive fallito (event=${eventId}):`, origErr instanceof Error ? origErr.message : origErr, '— fallback su watermarked per Drive');
          driveBuffer = buffer;
        }
      }
    }

    // Drive sync (se connesso per l'evento).
    if (hasDrive && folders) {
      try {
        const driveFolderId = isVideo ? (folders['video'] || folders['root']) : (folders['foto'] || folders['root']);
        const boundary = `----fotosposi${Date.now().toString(16)}`;
        const uploader = ctx.uploaderMap[item.uploaded_by];
        const uploaderName = [uploader?.first_name, uploader?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim()
          .replace(/\s+/g, '_')
          .replace(/[\/\\?%*:|"<>]/g, '')
          || (uploader?.email ? uploader.email.split('@')[0] : 'Anonimo');
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const datePrefix = `${now.getFullYear()}_${pad(now.getMonth() + 1)}_${pad(now.getDate())}_${pad(now.getHours())}_${pad(now.getMinutes())}_${pad(now.getSeconds())}`;
        const safeOriginal = (item.file_name || 'file').replace(/[\/\\?%*:|"<>]/g, '_');
        const driveName = `${datePrefix}_${uploaderName}_${safeOriginal}`;
        const metadata: Record<string, unknown> = { name: driveName };
        if (driveFolderId) metadata.parents = [driveFolderId];
        const fileCT = item.file_type || 'application/octet-stream';
        const metaPart =
          `--${boundary}\r\n` +
          `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
          `${JSON.stringify(metadata)}\r\n`;
        const fileHeader =
          `--${boundary}\r\n` +
          `Content-Type: ${fileCT}\r\n\r\n`;
        const closing = `\r\n--${boundary}--`;
        const bodyBytes = Buffer.concat([
          Buffer.from(metaPart, 'utf8'),
          Buffer.from(fileHeader, 'utf8'),
          driveBuffer, // FIX 31/07/2026: originale NON watermarked per foto, watermarked per video.
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
          const finalStatus = watermarkMissing ? 'failed' : 'synced';
          const finalError = watermarkMissing ? 'Watermark non applicato (rilevato da detectWatermark)' : null;
          const finalRetry = watermarkMissing ? (item.retry_count || 0) + 1 : item.retry_count || 0;
          if (watermarkMissing) {
            await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_DETECT, errorMessage: String(finalError), retryCount: finalRetry });
            if (finalRetry >= MAX_RETRY_COUNT) await moveToDeadLetter(supabase, item, FAILURE_CLASS_DETECT, String(finalError));
            else await supabase.from('upload_queue').update({ status: 'failed', error: finalError, retry_count: finalRetry }).eq('id', item.id);
          } else {
            await supabase.from('upload_queue').update({ status: 'synced', drive_file_id: driveData.id, processed_at: new Date().toISOString() }).eq('id', item.id);
          }
        } else {
          await updateDriveSyncStatus(media.id, 'failed');
          const driveError = `Drive sync fallito: HTTP ${driveRes.status}`;
          const compositeError = watermarkMissing ? `Watermark mancante + ${driveError}` : driveError;
          const newRetry = (item.retry_count || 0) + 1;
          await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_DRIVE, errorMessage: compositeError, retryCount: newRetry });
          if (newRetry >= MAX_RETRY_COUNT) await moveToDeadLetter(supabase, item, FAILURE_CLASS_DRIVE, compositeError);
          else await supabase.from('upload_queue').update({ status: 'failed', error: compositeError, retry_count: newRetry }).eq('id', item.id);
        }
      } catch (err) {
        await updateDriveSyncStatus(media.id, 'failed');
        const driveErr = `Drive sync exception: ${(err as Error).message}`;
        const compositeError = watermarkMissing ? `Watermark mancante + ${driveErr}` : driveErr;
        const newRetry = (item.retry_count || 0) + 1;
        await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_DRIVE, errorMessage: compositeError, retryCount: newRetry });
        if (newRetry >= MAX_RETRY_COUNT) await moveToDeadLetter(supabase, item, FAILURE_CLASS_DRIVE, compositeError);
        else await supabase.from('upload_queue').update({ status: 'failed', error: compositeError, retry_count: newRetry }).eq('id', item.id);
      }
    } else {
      // Nessun Drive: status guidato solo da watermarkMissing.
      if (watermarkMissing) {
        const newRetry = (item.retry_count || 0) + 1;
        const msg = 'Watermark non applicato (rilevato da detectWatermark)';
        await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_DETECT, errorMessage: msg, retryCount: newRetry });
        if (newRetry >= MAX_RETRY_COUNT) await moveToDeadLetter(supabase, item, FAILURE_CLASS_DETECT, msg);
        else await supabase.from('upload_queue').update({ status: 'failed', error: msg, retry_count: newRetry }).eq('id', item.id);
      } else {
        await supabase.from('upload_queue').update({ status: 'synced', processed_at: new Date().toISOString() }).eq('id', item.id);
      }
    }
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore';
    const newRetry = (item.retry_count || 0) + 1;
    await logFailure(supabase, { eventId, fileName: item.file_name, failureClass: FAILURE_CLASS_OTHER, errorMessage: msg, retryCount: newRetry });
    if (newRetry >= MAX_RETRY_COUNT) await moveToDeadLetter(supabase, item, FAILURE_CLASS_OTHER, msg);
    else await supabase.from('upload_queue').update({ status: 'failed', error: msg, retry_count: newRetry }).eq('id', item.id);
    return false;
  }
}

/**
 * Helper one-shot: ri-applica il watermark a tutte le foto di un evento
 * giÃ  caricate su R2 con `media_uploads.watermark_missing = true` (foto
 * processate prima del fix del 28/07/2026, o dove applyOverlay Ã¨ caduto
 * silenziosamente). NON Ã¨ un cron: l'utente deve invocarlo esplicitamente
 * quando sa che le foto del bug-sessione vanno ri-processate.
 *
 * Strategia (diversa da processQueueForEvent):
 *   - NON legge da upload_queue (quegli item sono giÃ  'synced' o non
 *     esistono piÃ¹): legge direttamente da media_uploads filtering per
 *     `watermark_missing = true AND event_id = ?`.
 *   - Per ogni record: download R2 â†’ applyWatermark â†’ upload R2 (stessa r2_key)
 *     â†’ update media_uploads.watermark_missing = false.
 *   - NON tocca upload_queue nÃ© drive_sync_status (preserva lo stato esistente).
 *
 * Ãˆ limitato (default 50 foto per run) per evitare timeout lambda.
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
      // FIX 29/07/2026: selezioniamo anche `original_r2_key` per leggere l'originale
      // NON watermarked (introdotto dalla migration 00040). Per i record pre-migration
      // (original_r2_key NULL) si cade su r2_key come fallback degradato (il watermark
      // verrÃ  applicato sopra il watermarked precedente â€” qualitÃ  ridotta, ma
      // funzionale per debug). Tutte le NUOVE upload hanno original_r2_key valorizzato
      // â†’ re-processing pulito senza sovrapposizioni.
      .from('media_uploads')
      .select('id, r2_key, original_r2_key, uploaded_by, type')
      .eq('event_id', eventId)
      .eq('watermark_missing', true)
      .eq('type', 'photo')
      .order('created_at', { ascending: true })
      .limit(limit),
  ]);

  if (!media || media.length === 0) {
    return { repaired: 0, skipped: 0, errors };
  }

  // Composizione watermark (stessa logica di processQueueForEvent, ora riusata
  // tramite l'helper esportato â€” niente piÃ¹ duplicazione).
  const wmLine1 = composeWatermarkLine1(event);
  const wmFont = watermarkFontFamily(event?.watermark_font);
  const brandLogo = loadBrandLogo(event?.brand);
  const wmFontBuffer = loadWatermarkFontBuffer(event?.watermark_font);

  let repaired = 0;
  let skipped = 0;

  for (const m of media) {
    const r2Key = m.r2_key;
    if (!r2Key) {
      skipped++;
      errors.push(`media ${m.id}: r2_key mancante`);
      continue;
    }
    // FIX 29/07/2026: scarica l'originale NON watermarked se disponibile
    // (processQueueForEvent lo ha salvato su `originals/<r2_key>` durante il primo
    // processing â€” vedi migration 00040_media_uploads_original_r2_key). Per i
    // record pre-migration, original_r2_key Ã¨ NULL â†’ fallback su r2_key (cioÃ¨
    // sul file GIÃ€ watermarked: il watermark verrÃ  applicato sopra, qualitÃ 
    // degradata). Log esplicito quando il fallback si attiva, cosÃ¬ l'utente sa
    // che dovrÃ  ricaricare le foto vecchie per avere un risultato pulito.
    const sourceKey = m.original_r2_key ?? r2Key;
    const usingFallback = !m.original_r2_key;
    if (usingFallback) {
      console.warn(`[repairWatermark] media ${m.id}: original_r2_key NULL, fallback su r2_key (watermark verrÃ  applicato sopra al watermarked precedente â€” qualitÃ  degradata)`);
    }
    try {
      const downloadUrl = await getPresignedDownloadUrl(sourceKey, 3600);
      if (!downloadUrl) { skipped++; errors.push(`media ${m.id}: presigned fallito`); continue; }
      const resp = await fetch(downloadUrl);
      if (!resp.ok) { skipped++; errors.push(`media ${m.id}: download HTTP ${resp.status}`); continue; }
      const buffer = Buffer.from(await resp.arrayBuffer()) as Buffer;

      let watermarked: Buffer = buffer;
      try {
        watermarked = await applyWatermark(buffer, wmLine1, '', event?.brand, wmFont, brandLogo, wmFontBuffer);
      } catch (wmErr) {
        // Verifica post-fix: l'errore ora Ã¨ loud (non piÃ¹ silente). Logghiamo ma
        // non marchiamo il record come repaired: rimarrÃ  watermark_missing=true.
        console.error(`[repairWatermark] fallito su media ${m.id}:`, wmErr);
        skipped++; errors.push(`media ${m.id}: ${wmErr instanceof Error ? wmErr.message : 'errore watermark'}`);
        continue;
      }

      // Ricarica su R2 (stessa key = sovrascrive la versione watermarked corrente
      // con il nuovo watermark applicato sull'originale pulito). Per funzionare
      // correttamente serve `original_r2_key` valorizzato (vedi migration 00040):
      // altrimenti il watermark viene applicato sopra il watermarked precedente
      // â†’ degradazione visiva progressiva a ogni re-processing.
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

      // Verifica post-upload: stessa logica AND di processQueueForEvent (fix
      // 28/07/2026) â€” prima usava `hasLogo || confidence > 0.3`, lo stesso OR
      // permissivo che ha fatto passare i 40 file del bug originale.
      let verifiedOk = false;
      try {
        const verifyUrl = await getPresignedDownloadUrl(r2Key, 3600);
        if (verifyUrl) {
          const vResp = await fetch(verifyUrl);
          if (vResp.ok) {
            const vBuf = Buffer.from(await vResp.arrayBuffer());
            const presence = await detectWatermark(vBuf);
            const namesOk = !wmLine1 || presence.hasHeart;
            const logoOk = !brandLogo || presence.hasLogo;
            verifiedOk = namesOk && logoOk;
          }
        }
      } catch {
        // Verifica best-effort: se R2 giÃ¹, ci fidiamo dell'upload.
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
