import { createServiceClient } from '@fotosposi/core';

export interface QueueItem {
  id: string;
  event_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string | null;
  compressed_path: string | null;
  drive_file_id: string | null;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  error: string | null;
  retry_count: number;
  created_at: string;
  processed_at: string | null;
  r2_key: string | null;
  compressed: boolean;
}

export type QueueStatus = QueueItem['status'];

export async function enqueueUpload(params: {
  event_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: string;
  file_size: number;
  compressed?: boolean;
}): Promise<{ id?: string; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('upload_queue')
    .insert({
      event_id: params.event_id,
      uploaded_by: params.uploaded_by,
      file_name: params.file_name,
      file_type: params.file_type,
      file_size: params.file_size,
      status: 'pending',
      compressed: params.compressed ?? false,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  return { id: data.id };
}

export async function getPendingQueue(eventId: string): Promise<{ items?: QueueItem[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('upload_queue')
    .select('*')
    .eq('event_id', eventId)
    .in('status', ['pending', 'processing', 'failed'])
    .order('created_at', { ascending: true });
  if (error) return { error: error.message };
  return { items: data ?? [] };
}

export async function updateQueueItem(
  id: string,
  updates: Partial<Pick<QueueItem, 'status' | 'storage_path' | 'compressed_path' | 'drive_file_id' | 'error' | 'retry_count' | 'processed_at' | 'r2_key'>>,
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('upload_queue').update(updates).eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function getQueueStats(eventId: string): Promise<{
  pending: number;
  processing: number;
  synced: number;
  failed: number;
}> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('upload_queue')
    .select('status')
    .eq('event_id', eventId);
  const items = data ?? [];
  return {
    pending: items.filter((i: { status: string }) => i.status === 'pending').length,
    processing: items.filter((i: { status: string }) => i.status === 'processing').length,
    synced: items.filter((i: { status: string }) => i.status === 'synced').length,
    failed: items.filter((i: { status: string }) => i.status === 'failed').length,
  };
}

export async function clearCompletedQueue(eventId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('upload_queue')
    .delete()
    .eq('event_id', eventId)
    .in('status', ['synced', 'failed']);
  return { error: error?.message };
}
