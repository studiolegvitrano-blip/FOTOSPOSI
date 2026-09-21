import { getPresignedDownloadUrl, getPresignedUploadUrl } from '@fotosposi/r2-storage';
import {
  applyVideoOverlayRemoteAsync,
  brandingToRemote,
  isVpsWatermarkConfigured,
  submitVideoWatermarkJob,
  type VideoOverlayBranding,
} from '@fotosposi/video-overlay';
import type { TimeCapsuleMessage } from './index';
import { updateCapsule } from './service';

/** Frase fissa nel watermark delle capsule — DA DECIDERE (placeholder). */
export const FRASE_NOSTRA_WATERMARK = 'Sposi.live · Capsula del Tempo';

/** Video messaggio: max 3 minuti. */
export const CAPSULE_MAX_VIDEO_SECONDS = 180;

/** Frase utente nel watermark: max caratteri (la size si adatta da sola nel renderer). */
export const CAPSULE_MAX_PHRASE_CHARS = 60;

/**
 * Testo della striscia watermark capsula: frase utente + frase nostra.
 * Il renderer (video-overlay) scala la size per rientrare nei limiti.
 */
export function buildCapsuleWatermarkText(userPhrase?: string | null): string {
  const phrase = (userPhrase || '').trim();
  if (!phrase) return FRASE_NOSTRA_WATERMARK;
  return `${phrase} · ${FRASE_NOSTRA_WATERMARK}`;
}

/**
 * Sottomette il job watermark di una capsula video SENZA polling (per le route
 * create/confirm con lifetime breve): presign download/upload + submit 202.
 * Il poll/resume avviene nel cron (runCapsuleSweep → processCapsuleWatermarkJob).
 */
export async function submitCapsuleWatermarkJob(
  capsuleId: string,
  r2Key: string,
  branding: VideoOverlayBranding,
): Promise<{ jobId?: string; error?: string }> {
  if (!isVpsWatermarkConfigured()) return { error: 'VPS watermark non configurato' };

  const slashIdx = r2Key.lastIndexOf('/');
  const prefix = slashIdx >= 0 ? r2Key.slice(0, slashIdx) : 'capsule';
  const baseName = slashIdx >= 0 ? r2Key.slice(slashIdx + 1) : r2Key;
  const wmFilename = `${baseName.replace(/\.(mp4|mov|webm|avi|m4v)$/i, '')}.wm.mp4`;

  const downloadUrl = await getPresignedDownloadUrl(r2Key, 3600);
  if (!downloadUrl) return { error: 'Presigned download fallito' };

  const ul = await getPresignedUploadUrl(prefix, wmFilename, 'video/mp4');
  if (!ul.success || !ul.presignedUrl) return { error: (!ul.success ? ul.error : undefined) || 'Presigned upload fallito' };

  try {
    const resp = await submitVideoWatermarkJob({
      downloadUrl,
      uploadUrl: ul.presignedUrl,
      branding: brandingToRemote(branding),
    });
    if (!resp.ok || !resp.jobId) return { error: resp.error || 'Submit VPS senza jobId' };
    return { jobId: resp.jobId };
  } catch (err) {
    return { error: String(err) };
  }
}

/**
 * Processa il job watermark di una capsula video via protocollo async VPS
 * (stesso schema del flusso media: presign download → presign upload .wm.mp4 →
 * submit/poll con resume video_job_id). Al completamento il .wm.mp4 diventa
 * la r2_key principale; l'originale resta su original_r2_key.
 */
export async function processCapsuleWatermarkJob(
  capsule: Pick<TimeCapsuleMessage, 'id' | 'r2_key' | 'original_r2_key' | 'video_job_id' | 'retry_count'>,
  branding: VideoOverlayBranding,
  opts?: { pollBudgetMs?: number },
): Promise<{ inProgress?: boolean; jobId?: string; completed?: boolean; error?: string }> {
  const sourceKey = capsule.original_r2_key || capsule.r2_key;
  if (!sourceKey) return { error: 'Capsula senza r2_key' };

  if (!isVpsWatermarkConfigured()) {
    await updateCapsule(capsule.id, { status: 'failed', last_error: 'VPS watermark non configurato', video_job_id: null });
    return { error: 'VPS watermark non configurato' };
  }

  const slashIdx = sourceKey.lastIndexOf('/');
  const prefix = slashIdx >= 0 ? sourceKey.slice(0, slashIdx) : 'capsule';
  const baseName = slashIdx >= 0 ? sourceKey.slice(slashIdx + 1) : sourceKey;
  const wmFilename = `${baseName.replace(/\.(mp4|mov|webm|avi|m4v)$/i, '')}.wm.mp4`;

  const downloadUrl = await getPresignedDownloadUrl(sourceKey, 3600);
  if (!downloadUrl) {
    await updateCapsule(capsule.id, { status: 'failed', last_error: 'Presigned download fallito', video_job_id: null, retry_count: (capsule.retry_count ?? 0) + 1 });
    return { error: 'Presigned download fallito' };
  }

  const ul = await getPresignedUploadUrl(prefix, wmFilename, 'video/mp4');
  if (!ul.success || !ul.presignedUrl) {
    await updateCapsule(capsule.id, { status: 'failed', last_error: (!ul.success ? ul.error : undefined) || 'Presigned upload fallito', video_job_id: null, retry_count: (capsule.retry_count ?? 0) + 1 });
    return { error: (!ul.success ? ul.error : undefined) || 'Presigned upload fallito' };
  }

  const asyncResp = await applyVideoOverlayRemoteAsync(
    { downloadUrl, uploadUrl: ul.presignedUrl, branding: brandingToRemote(branding) },
    { resumeJobId: capsule.video_job_id || undefined, pollBudgetMs: opts?.pollBudgetMs ?? 150_000 },
  );

  if (asyncResp.inProgress && asyncResp.jobId) {
    await updateCapsule(capsule.id, { video_job_id: asyncResp.jobId });
    return { inProgress: true, jobId: asyncResp.jobId };
  }

  if (asyncResp.error || !asyncResp.ok) {
    await updateCapsule(capsule.id, {
      status: 'failed',
      last_error: asyncResp.error || 'Watermark VPS fallito',
      video_job_id: null,
      retry_count: (capsule.retry_count ?? 0) + 1,
    });
    return { error: asyncResp.error || 'Watermark VPS fallito' };
  }

  await updateCapsule(capsule.id, {
    r2_key: ul.key,
    original_r2_key: sourceKey,
    status: 'scheduled',
    video_job_id: null,
    last_error: null,
  });
  return { completed: true };
}
