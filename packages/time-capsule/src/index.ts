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
}

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
} from './service';
