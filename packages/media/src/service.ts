import { createServiceClient } from '@fotosposi/core';
import { getPresignedUploadUrl, deleteObject } from '@fotosposi/r2-storage';
import type { MediaUpload, VideoMessage } from './index';

export async function createMediaRecord(params: {
  event_id: string;
  sub_event_id?: string;
  uploaded_by: string;
  type: 'photo' | 'video';
  url: string;
  compressed?: boolean;
  r2_key?: string;
  watermark_missing?: boolean;
}): Promise<{ media?: MediaUpload; error?: string }> {
  const supabase = createServiceClient();
  // Upsert su (event_id, r2_key): se un retry della coda processa lo stesso r2_key
  // (es. errore transiente di Drive sync), NON crea un duplicato in media_uploads.
  // La constraint unique `uniq_media_event_r2key` assicura questo a livello DB.
  // Per record senza r2_key (legacy) il fallback è INSERT con rischio di duplicato
  // accettabile — il numero di questi casi è ormai prossimo a zero.
  const baseRow = {
    event_id: params.event_id,
    sub_event_id: params.sub_event_id ?? null,
    uploaded_by: params.uploaded_by,
    type: params.type,
    url: params.url,
    drive_sync_status: 'pending' as const,
    compressed: params.compressed ?? false,
    r2_key: params.r2_key ?? null,
    watermark_missing: params.watermark_missing ?? false,
  };
  const query = params.r2_key
    ? supabase
        .from('media_uploads')
        .upsert(baseRow, { onConflict: 'event_id,r2_key', ignoreDuplicates: false })
    : supabase.from('media_uploads').insert(baseRow);
  let { data, error } = await query.select().single();
  // Fallback robusto: se il unique constraint `uniq_media_event_r2key` non è ancora
  // stato applicato (DB drift tra repo e remote), Supabase rifiuta l'upsert con
  // "there is no unique or exclusion constraint matching the ON CONFLICT specification".
  // In quel caso ripieghiamo su un INSERT semplice: il record verrà creato e, se per
  // caso un cron sweep riprocessa lo stesso r2_key, avremo un duplicato (accettabile
  // per non perdere TUTTE le foto di un evento finché la migration non viene applicata).
  if (error && /ON CONFLICT|unique or exclusion constraint/i.test(error.message)) {
    console.error('createMediaRecord: ON CONFLICT constraint mancante, fallback INSERT semplice. Applica migration 00037_media_uploads_unique_event_r2key.sql per ripristinare l\'upsert idempotente.');
    const fallback = await supabase
      .from('media_uploads')
      .insert(baseRow)
      .select()
      .single();
    data = fallback.data;
    error = fallback.error;
  }
  if (error) return { error: error.message };
  return { media: data };
}

export async function getCuratedMediaByEvent(eventId: string): Promise<{ media?: MediaUpload[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('media_uploads')
    .select('*')
    .eq('event_id', eventId)
    .order('wall_priority_score', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return { error: error.message };

  if (!data) return { media: [] };

  const result: MediaUpload[] = [];
  const used = new Set<string>();
  const remaining = [...data];

  while (remaining.length > 0) {
    const idx = remaining.findIndex(m => !used.has(m.id));
    if (idx === -1) break;
    const item = remaining[idx];
    remaining.splice(idx, 1);
    result.push(item);
    used.add(item.id);

    const lastUploader = item.uploaded_by;
    const sameUserIdx = remaining.findIndex(m => m.uploaded_by === lastUploader);
    if (sameUserIdx !== -1) {
      const skip = remaining[sameUserIdx];
      if (skip) {
        result.push(skip);
        remaining.splice(sameUserIdx, 1);
        used.add(skip.id);
      }
    }
  }

  result.push(...remaining);
  return { media: result };
}

export async function getMediaByEvent(eventId: string): Promise<{ media?: MediaUpload[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('media_uploads')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { media: data ?? [] };
}

export async function getMediaBySubEvent(subEventId: string): Promise<{ media?: MediaUpload[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('media_uploads')
    .select('*')
    .eq('sub_event_id', subEventId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { media: data ?? [] };
}

export async function uploadToR2(
  prefix: string,
  filename: string,
  contentType: string,
): Promise<{ key?: string; url?: string; presignedUrl?: string; error?: string }> {
  const result = await getPresignedUploadUrl(prefix, filename, contentType);
  if (!result.success) return { error: result.error };
  return { key: result.key, url: result.url, presignedUrl: result.presignedUrl };
}

export async function deleteFromR2(key: string): Promise<{ error?: string }> {
  const ok = await deleteObject(key);
  if (!ok) return { error: 'Errore cancellazione R2' };
  return {};
}

export async function uploadToStorage(
  bucket: string,
  path: string,
  file: File | Blob,
): Promise<{ url?: string; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) return { error: error.message };

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return { url: urlData.publicUrl };
}

export async function deleteFromStorage(
  bucket: string,
  path: string,
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) return { error: error.message };
  return {};
}

export async function createVideoMessage(params: {
  event_id: string;
  from_user: string;
  from_name?: string;
  type: 'welcome' | 'guestbook';
  url: string;
  r2_key?: string;
  is_public?: boolean;
}): Promise<{ message?: VideoMessage; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('video_messages')
    .insert(params)
    .select()
    .single();
  if (error) return { error: error.message };
  return { message: data };
}

export async function getVideoMessages(
  eventId: string,
  type?: 'welcome' | 'guestbook',
): Promise<{ messages?: VideoMessage[]; error?: string }> {
  const supabase = createServiceClient();
  let query = supabase.from('video_messages').select('*').eq('event_id', eventId);
  if (type) query = query.eq('type', type);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { messages: data ?? [] };
}

export async function updateDriveSyncStatus(
  mediaId: string,
  status: 'pending' | 'synced' | 'failed',
  driveFileId?: string,
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const update: Record<string, unknown> = { drive_sync_status: status };
  if (driveFileId) update.drive_file_id = driveFileId;
  const { error } = await supabase.from('media_uploads').update(update).eq('id', mediaId);
  if (error) return { error: error.message };
  return {};
}

export { saveDriveToken, getDriveToken, deleteDriveToken, refreshDriveAccessToken, getEventDriveFolders } from './tokens';
export type { EventDriveToken } from './tokens';
