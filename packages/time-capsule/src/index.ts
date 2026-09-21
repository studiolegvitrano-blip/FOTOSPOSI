export interface TimeCapsuleMessage {
  id: string;
  event_id: string;
  sender_type: 'sposo' | 'sposa' | 'invitato';
  sender_name: string;
  sender_user_id: string | null;
  recipient_type: 'sposi' | 'sposo' | 'sposa' | 'singolo' | 'gruppo';
  recipient_name: string | null;
  recipient_group: string | null;
  message_type: 'text' | 'photo' | 'video';
  content: string | null;
  file_url: string | null;
  storage_path: string | null;
  drive_file_id: string | null;
  drive_sync_status: 'pending' | 'synced' | 'failed';
  reveal_at: string;
  delivered_at: string | null;
  downloaded_at: string | null;
  drive_trashed_at: string | null;
  drive_permanently_deleted: boolean;
  created_at: string;
  r2_key?: string | null;
  original_r2_key?: string | null;
  watermark_phrase?: string | null;
  delivery_channel?: 'email' | 'whatsapp' | 'app' | null;
  recipient_email?: string | null;
  recipient_whatsapp?: string | null;
  recipient_guest_id?: string | null;
  status?: 'awaiting_payment' | 'processing' | 'scheduled' | 'delivered' | 'failed' | null;
  video_job_id?: string | null;
  last_error?: string | null;
  payment_required?: boolean | null;
  price_cents?: number | null;
  order_id?: string | null;
  access_token?: string | null;
  retry_count?: number | null;
}

export type CapsuleStatus = NonNullable<TimeCapsuleMessage['status']>;
export type CapsuleDeliveryChannel = NonNullable<TimeCapsuleMessage['delivery_channel']>;

export interface EventCode {
  id: string;
  event_id: string;
  code: string;
  country: string;
  sequence: number;
  created_at: string;
}

export function buildFileName(revealAt: string, eventCode: string): string {
  const d = new Date(revealAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}_${mm}_${dd}_${eventCode}`;
}

export {
  getEventCode,
  createCapsuleMessage,
  getCapsuleMessages,
  getDueCapsuleMessages,
  markDelivered,
  markDownloaded,
  syncCapsuleToDrive,
  trashOnDrive,
  permanentDeleteFromDrive,
  cleanupSupabaseStorage,
  getCapsuleById,
  getCapsuleByToken,
  getCapsulesForUser,
  getCapsulesForRecipientGuest,
  getVideoJobsPending,
  getFailedVideoCapsules,
  getDueScheduledCapsules,
  updateCapsule,
} from './service';

export {
  CAPSULE_MIN_MONTHS,
  CAPSULE_MAX_MONTHS,
  CAPSULE_FREE_MONTHS,
  CAPSULE_PRICE_BASE_EUR,
  CAPSULE_PRICE_PER_MONTH_EUR,
  clampCapsuleMonths,
  computeCapsulePriceCents,
  capsulePaymentRequired,
  formatCapsulePrice,
} from './pricing';
export type { CapsulePriceOptions } from './pricing';

export {
  FRASE_NOSTRA_WATERMARK,
  CAPSULE_MAX_VIDEO_SECONDS,
  CAPSULE_MAX_PHRASE_CHARS,
  buildCapsuleWatermarkText,
  submitCapsuleWatermarkJob,
  processCapsuleWatermarkJob,
} from './watermark';

export { runCapsuleSweep } from './delivery';
export type { CapsuleSweepResult } from './delivery';
