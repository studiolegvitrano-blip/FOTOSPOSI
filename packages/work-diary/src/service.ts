import { createServiceClient } from '@fotosposi/core';
import type { WorkDiaryEntry, DiarySummary } from './index';

export async function createDiaryEntry(params: {
  event_id: string;
  task: string;
  phase?: string;
  notes?: string;
  financial_link?: string;
  due_date?: string;
  created_by?: string;
}): Promise<{ entry?: WorkDiaryEntry; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_work_diary')
    .insert({
      event_id: params.event_id,
      task: params.task,
      phase: params.phase ?? 'bozza',
      notes: params.notes ?? null,
      financial_link: params.financial_link ?? null,
      due_date: params.due_date ?? null,
      created_by: params.created_by ?? null,
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { entry: data };
}

export async function updateDiaryEntry(
  id: string,
  updates: Partial<Pick<WorkDiaryEntry, 'task' | 'status' | 'phase' | 'notes' | 'financial_link' | 'due_date'>>,
): Promise<{ entry?: WorkDiaryEntry; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_work_diary')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { entry: data };
}

export async function deleteDiaryEntry(id: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('event_work_diary').delete().eq('id', id);
  if (error) return { error: error.message };
  return {};
}

export async function getDiaryEntries(eventId: string): Promise<{ entries?: WorkDiaryEntry[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_work_diary')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { entries: data ?? [] };
}

export async function getDiarySummary(eventId: string): Promise<{ summary?: DiarySummary; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_work_diary')
    .select('*')
    .eq('event_id', eventId);
  if (error) return { error: error.message };
  const entries = data ?? [];
  const first = entries[0];
  return {
    summary: {
      total: entries.length,
      todo: entries.filter(e => e.status === 'todo').length,
      done: entries.filter(e => e.status === 'done').length,
      cancelled: entries.filter(e => e.status === 'cancelled').length,
      phase: first?.phase || 'bozza',
    },
  };
}

export async function updateEventPhase(eventId: string, phase: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('event_work_diary')
    .update({ phase, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);
  if (error) return { error: error.message };
  return {};
}
