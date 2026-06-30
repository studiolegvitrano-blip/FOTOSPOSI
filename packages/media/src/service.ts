import { createServiceClient } from '@fotosposi/core';
import type { MediaUpload, VideoMessage } from './index';

export async function createMediaRecord(params: {
  event_id: string;
  sub_event_id?: string;
  uploaded_by: string;
  type: 'photo' | 'video';
  url: string;
}): Promise<{ media?: MediaUpload; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('media_uploads')
 .insert({
   event_id: params.event_id,
   sub_event_id: params.sub_event_id ?? null,
   uploaded_by: params.uploaded_by,
   type: params.type,
   url: params.url,
   drive_sync_status: 'pending',
 })
 .select()
 .single();

  if (error) return { error: error.message };
  return { media: data };
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

export async function createVideoMessage(params: {
  event_id: string;
  from_user: string;
  type: 'welcome' | 'guestbook';
  url: string;
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

export { saveDriveToken, getDriveToken, deleteDriveToken, refreshDriveAccessToken } from './tokens';
export type { EventDriveToken } from './tokens';
