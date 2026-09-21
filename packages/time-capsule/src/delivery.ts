import { sendNotification } from '@fotosposi/notifications';
import type { TimeCapsuleMessage } from './index';
import { getDueScheduledCapsules, getFailedVideoCapsules, getVideoJobsPending, markDelivered, updateCapsule } from './service';
import { processCapsuleWatermarkJob } from './watermark';
import type { VideoOverlayBranding } from '@fotosposi/video-overlay';

export interface CapsuleSweepResult {
  status: 'ok' | 'warning' | 'error';
  jobsResumed: number;
  jobsCompleted: number;
  reSubmitted: number;
  delivered: number;
  whatsappPending: number;
  errors: string[];
}

/** Presigned download del video capsula (per link email/vista destinatario). */
export async function getCapsuleVideoUrl(r2Key: string, expiresIn = 3600): Promise<string | null> {
  const { getPresignedDownloadUrl } = await import('@fotosposi/r2-storage');
  return getPresignedDownloadUrl(r2Key, expiresIn);
}

/**
 * Sweep capsula del tempo (cron giornaliero):
 *   1. Resume job watermark in corso (processing + video_job_id) — senza re-encode.
 *   2. Re-submit capsule video fallite (retry_count < 3).
 *   3. Trasmissione: scheduled + reveal_at passata →
 *      - channel email → email Resend con link alla vista destinatario
 *      - channel whatsapp → pending (provider WhatsApp da completare)
 *      - channel app → visibile nella pagina capsula → mark delivered
 *
 * I branding (logo sposi/partner, font, frase) sono assemblati dal chiamante
 * in apps/web (watermark-fonts.server.ts) e passati qui per capsule.
 */
export async function runCapsuleSweep(opts?: {
  baseUrl?: string;
  brandingFor?: (capsule: TimeCapsuleMessage) => Promise<VideoOverlayBranding>;
  pollBudgetMs?: number;
  watermarkLimit?: number;
  deliveryLimit?: number;
}): Promise<CapsuleSweepResult> {
  const result: CapsuleSweepResult = {
    status: 'ok',
    jobsResumed: 0,
    jobsCompleted: 0,
    reSubmitted: 0,
    delivered: 0,
    whatsappPending: 0,
    errors: [],
  };

  // 1. Resume job watermark in corso
  const { messages: pendingJobs } = await getVideoJobsPending(opts?.watermarkLimit ?? 5);
  for (const capsule of pendingJobs || []) {
    if (!opts?.brandingFor) break;
    result.jobsResumed++;
    try {
      const resp = await processCapsuleWatermarkJob(capsule, await opts.brandingFor(capsule), {
        pollBudgetMs: opts?.pollBudgetMs ?? 150_000,
      });
      if (resp.completed) result.jobsCompleted++;
      if (resp.error) result.errors.push(`${capsule.id}: ${resp.error}`);
    } catch (err) {
      result.errors.push(`${capsule.id}: ${String(err)}`);
    }
  }

  // 2. Re-submit capsule video fallite (retry_count < 3)
  const { messages: failedCapsules } = await getFailedVideoCapsules(3);
  for (const capsule of failedCapsules || []) {
    if (!opts?.brandingFor) break;
    // Guard revenue: una capsula payment_required senza order (checkout mai creato)
    // NON deve mai essere processata/consegnata gratis. Le capsule PAID fallite
    // dopo il pagamento (order_id presente) vengono riprocessate regolarmente.
    if (capsule.payment_required && !capsule.order_id) {
      result.errors.push(`skip ${capsule.id}: capsula non pagata (niente order) — non processata`);
      continue;
    }
    try {
      await updateCapsule(capsule.id, { status: 'processing', video_job_id: null });
      const resp = await processCapsuleWatermarkJob(capsule, await opts.brandingFor(capsule), {
        pollBudgetMs: opts?.pollBudgetMs ?? 150_000,
      });
      if (resp.completed || resp.inProgress) result.reSubmitted++;
      if (resp.error) result.errors.push(`resubmit ${capsule.id}: ${resp.error}`);
    } catch (err) {
      result.errors.push(`resubmit ${capsule.id}: ${String(err)}`);
    }
  }

  // 3. Trasmissione delle capsule scadute (reveal_at passata)
  const { messages: due } = await getDueScheduledCapsules(opts?.deliveryLimit ?? 20);
  for (const capsule of due || []) {
    try {
      if (capsule.delivery_channel === 'email' && capsule.recipient_email) {
        const link = buildCapsuleLink(capsule, opts?.baseUrl);
        const { error } = await sendNotification({
          event_id: capsule.event_id,
          channel: 'email',
          recipient: capsule.recipient_email,
          subject: 'Hai ricevuto una Capsula del Tempo',
          body: `Ciao${capsule.recipient_name ? ` ${capsule.recipient_name}` : ''},\n\nuna capsula del tempo è stata aperta per te.\nGuardala qui: ${link}\n\nIl link è personale: non condividerlo.`,
        });
        if (error) {
          result.errors.push(`email ${capsule.id}: ${error}`);
          continue;
        }
        await markDelivered(capsule.id);
        await updateCapsule(capsule.id, { status: 'delivered' });
        result.delivered++;
      } else if (capsule.delivery_channel === 'whatsapp') {
        // WhatsApp: provider da completare — la capsula resta scheduled e verrà
        // ritrasmessa quando il canale sarà attivo.
        result.whatsappPending++;
      } else {
        // channel app (o testo legacy): visibile nella pagina capsula del destinatario.
        await markDelivered(capsule.id);
        await updateCapsule(capsule.id, { status: 'delivered' });
        result.delivered++;
      }
    } catch (err) {
      result.errors.push(`deliver ${capsule.id}: ${String(err)}`);
    }
  }

  if (result.errors.length > 0) result.status = 'warning';
  return result;
}

function buildCapsuleLink(capsule: TimeCapsuleMessage, baseUrl?: string): string {
  const base = (baseUrl || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sposi.live').replace(/\/$/, '');
  const token = capsule.access_token ? `?t=${capsule.access_token}` : '';
  return `${base}/event/capsula/${capsule.id}${token}`;
}
