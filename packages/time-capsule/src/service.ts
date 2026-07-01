import { createServiceClient } from '@fotosposi/core';
import { getDriveToken, getEventDriveFolders, deleteFromStorage } from '@fotosposi/media';
import { getEventById } from '@fotosposi/events';
import type { TimeCapsuleMessage, EventCode } from './index';
import { buildFileName } from './index';

export async function getEventCode(eventId: string): Promise<{ code?: EventCode; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_codes')
    .select('*')
    .eq('event_id', eventId)
    .single();
  if (error && error.code !== 'PGRST116') return { error: error.message };
  return { code: data ?? undefined };
}

export async function ensureEventCode(eventId: string, country = 'IT'): Promise<{ code?: EventCode; error?: string }> {
  const existing = await getEventCode(eventId);
  if (existing.code) return existing;

  const supabase = createServiceClient();
  const codeStr = await generateCode(supabase, country);

  const { data, error } = await supabase
    .from('event_codes')
    .insert({ event_id: eventId, code: codeStr, country, sequence: parseInt(codeStr.slice(-3), 10) })
    .select()
    .single();
  if (error) return { error: error.message };
  return { code: data };
}

async function generateCode(supabase: any, country: string): Promise<string> {
  const { data } = await supabase.rpc('generate_event_code', { p_country: country });
  if (data) return data;

  const { data: maxRow } = await supabase
    .from('event_codes')
    .select('sequence')
    .eq('country', country)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = (maxRow?.sequence ?? 0) + 1;
  return `EV_${country}${String(nextSeq).padStart(3, '0')}`;
}

export async function createCapsuleMessage(params: {
  event_id: string;
  sender_type: 'sposo' | 'sposa' | 'invitato';
  sender_name: string;
  sender_user_id?: string;
  recipient_type: 'sposi' | 'sposo' | 'sposa' | 'singolo' | 'gruppo';
  recipient_name?: string;
  recipient_group?: string;
  message_type: 'text' | 'photo' | 'video';
  content?: string;
  file_url?: string;
  storage_path?: string;
  reveal_at: string;
}): Promise<{ message?: TimeCapsuleMessage; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('time_capsule_messages')
    .insert({
      event_id: params.event_id,
      sender_type: params.sender_type,
      sender_name: params.sender_name,
      sender_user_id: params.sender_user_id ?? null,
      recipient_type: params.recipient_type,
      recipient_name: params.recipient_name ?? null,
      recipient_group: params.recipient_group ?? null,
      message_type: params.message_type,
      content: params.content ?? null,
      file_url: params.file_url ?? null,
      storage_path: params.storage_path ?? null,
      reveal_at: params.reveal_at,
      drive_sync_status: params.storage_path ? 'pending' : 'synced',
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { message: data };
}

export async function getCapsuleMessages(
  eventId: string,
  recipientType?: string,
): Promise<{ messages?: TimeCapsuleMessage[]; error?: string }> {
  const supabase = createServiceClient();
  let query = supabase
    .from('time_capsule_messages')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (recipientType) query = query.eq('recipient_type', recipientType);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { messages: data ?? [] };
}

export async function getDueCapsuleMessages(): Promise<{ messages?: TimeCapsuleMessage[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('time_capsule_messages')
    .select('*')
    .lte('reveal_at', new Date().toISOString())
    .is('delivered_at', null)
    .order('reveal_at', { ascending: true });
  if (error) return { error: error.message };
  return { messages: data ?? [] };
}

export async function markDelivered(messageId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('time_capsule_messages')
    .update({ delivered_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) return { error: error.message };
  return {};
}

export async function markDownloaded(messageId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('time_capsule_messages')
    .update({ downloaded_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) return { error: error.message };
  return {};
}

export async function syncCapsuleToDrive(
  messageId: string,
): Promise<{ fileId?: string; error?: string }> {
  const supabase = createServiceClient();
  const { data: msg, error: msgErr } = await supabase
    .from('time_capsule_messages')
    .select('*')
    .eq('id', messageId)
    .single();
  if (msgErr || !msg) return { error: msgErr?.message || 'Message not found' };

  if (msg.drive_sync_status === 'synced') return { fileId: msg.drive_file_id! };
  if (!msg.file_url || !msg.storage_path) {
    await supabase.from('time_capsule_messages').update({ drive_sync_status: 'synced' }).eq('id', messageId);
    return {};
  }

  const { event } = await getEventById(msg.event_id);
  if (!event) return { error: 'Event not found' };

  const { token } = await getDriveToken(msg.event_id);
  if (!token?.access_token) return { error: 'Drive not connected' };

  const { folders } = await getEventDriveFolders(msg.event_id);
  const folderId = folders?.['Foto'] || folders?.['Video'] || folders?.['root'];

  const { code } = await getEventCode(msg.event_id);
  const eventCode = code?.code || msg.event_id.slice(0, 8);
  const fileName = buildFileName(msg.reveal_at, eventCode);

  const ext = msg.file_url.split('.').pop() || 'jpg';
  const fullName = `${fileName}.${ext}`;

  try {
    const fileRes = await fetch(msg.file_url);
    if (!fileRes.ok) throw new Error('Cannot fetch file');
    const blob = await fileRes.blob();

    const formData = new FormData();
    formData.append('file', blob, fullName);
    const metadata: Record<string, unknown> = { name: fullName };
    if (folderId) metadata.parents = [folderId];
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

    const driveRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.access_token}` },
        body: formData,
      },
    );
    const driveData = await driveRes.json();
    if (!driveRes.ok || !driveData.id) throw new Error(driveData.error?.message || 'Drive upload failed');

    await supabase
      .from('time_capsule_messages')
      .update({ drive_file_id: driveData.id, drive_sync_status: 'synced' })
      .eq('id', messageId);

    await deleteFromStorage('media', msg.storage_path);
    await supabase
      .from('time_capsule_messages')
      .update({ file_url: null, storage_path: null })
      .eq('id', messageId);

    return { fileId: driveData.id };
  } catch (err) {
    await supabase
      .from('time_capsule_messages')
      .update({ drive_sync_status: 'failed' })
      .eq('id', messageId);
    return { error: String(err) };
  }
}

export async function trashOnDrive(messageId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { data: msg } = await supabase
    .from('time_capsule_messages')
    .select('drive_file_id, event_id')
    .eq('id', messageId)
    .single();
  if (!msg?.drive_file_id) return { error: 'No Drive file ID' };

  const { token } = await getDriveToken(msg.event_id);
  if (!token?.access_token) return { error: 'Drive not connected' };

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${msg.drive_file_id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok) return { error: 'Failed to trash on Drive' };

  await supabase
    .from('time_capsule_messages')
    .update({ drive_trashed_at: new Date().toISOString() })
    .eq('id', messageId);
  return {};
}

export async function permanentDeleteFromDrive(messageId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { data: msg } = await supabase
    .from('time_capsule_messages')
    .select('drive_file_id, event_id')
    .eq('id', messageId)
    .single();
  if (!msg?.drive_file_id) return {};

  const { token } = await getDriveToken(msg.event_id);
  if (!token?.access_token) return { error: 'Drive not connected' };

  await fetch(`https://www.googleapis.com/drive/v3/files/${msg.drive_file_id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  await supabase
    .from('time_capsule_messages')
    .update({ drive_permanently_deleted: true })
    .eq('id', messageId);
  return {};
}

export async function cleanupSupabaseStorage(messageId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { data: msg } = await supabase
    .from('time_capsule_messages')
    .select('storage_path')
    .eq('id', messageId)
    .single();
  if (!msg?.storage_path) return {};
  const { error } = await deleteFromStorage('media', msg.storage_path);
  if (error) return { error };
  await supabase
    .from('time_capsule_messages')
    .update({ storage_path: null, file_url: null })
    .eq('id', messageId);
  return {};
}
