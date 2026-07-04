import { createServiceClient } from './supabase';

export interface EventGuest {
  id: string;
  event_id: string;
  user_id: string;
  name: string;
  email?: string;
  status: 'pending' | 'approved' | 'denied';
  registered_at: string;
}

export async function getEventGuests(eventId: string): Promise<{ guests?: EventGuest[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_guests')
    .select('*')
    .eq('event_id', eventId)
    .order('registered_at', { ascending: false });
  if (error) return { error: error.message };
  return { guests: data ?? [] };
}

export async function updateGuestStatus(
  guestId: string,
  status: 'pending' | 'approved' | 'denied',
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('event_guests').update({ status }).eq('id', guestId);
  if (error) return { error: error.message };
  return {};
}

export async function registerGuest(params: {
  event_id: string;
  user_id: string;
  name: string;
  email?: string;
}): Promise<{ guest?: EventGuest; error?: string }> {
  const supabase = createServiceClient();
  const { data: event } = await supabase
    .from('events')
    .select('guest_approval_mode')
    .eq('id', params.event_id)
    .single();
  const status = event?.guest_approval_mode === 'manual' ? 'pending' : 'approved';
  const { data, error } = await supabase
    .from('event_guests')
    .upsert({ ...params, status }, { onConflict: 'event_id,user_id' })
    .select()
    .single();
  if (error) return { error: error.message };
  return { guest: data };
}

export async function updateGuestApprovalMode(
  eventId: string,
  mode: 'auto' | 'manual',
): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('events').update({ guest_approval_mode: mode }).eq('id', eventId);
  if (error) return { error: error.message };
  return {};
}

export async function getEventById(
  eventId: string,
): Promise<{ event?: Record<string, unknown>; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (error) return { error: error.message };
  return { event: data ?? undefined };
}
