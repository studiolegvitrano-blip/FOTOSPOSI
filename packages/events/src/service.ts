import { createClient } from '@fotosposi/core';
import { calculateWindow } from './index';
import type { WeddingEvent, SubEvent, EventWindow } from './index';

export async function createEvent(params: {
  tenant_id: string;
  created_by: string;
  couple_name: string;
  date: string;
  location: string;
  church?: string;
  venue?: string;
  brand: 'fotosposi' | 'weddingmoments';
  tier?: 'base' | 'premium' | 'destination';
}): Promise<{ event?: WeddingEvent; error?: string }> {
  const supabase = createClient();

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      tenant_id: params.tenant_id,
      created_by: params.created_by,
      couple_name: params.couple_name,
      date: params.date,
      location: params.location,
      church: params.church,
      venue: params.venue,
      brand: params.brand,
      tier: params.tier ?? 'base',
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const window = calculateWindow(params.date);
  await supabase.from('event_windows').insert({
    event_id: event.id,
    opens_at: window.opens_at,
    closes_at: window.closes_at,
  });

  return { event };
}

export async function getEventById(eventId: string): Promise<{ event?: WeddingEvent; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  if (error) return { error: error.message };
  return { event: data };
}

export async function getEventsByUser(userId: string): Promise<{ events?: WeddingEvent[]; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', userId)
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { events: data ?? [] };
}

export async function createSubEvent(params: {
  event_id: string;
  type: 'addio_celibato' | 'matrimonio' | 'brunch' | 'cena_prova';
  title: string;
  date: string;
  location?: string;
}): Promise<{ subEvent?: SubEvent; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sub_events')
    .insert(params)
    .select()
    .single();
  if (error) return { error: error.message };
  return { subEvent: data };
}

export async function getSubEvents(eventId: string): Promise<{ subEvents?: SubEvent[]; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('sub_events')
    .select('*')
    .eq('event_id', eventId)
    .order('date', { ascending: true });
  if (error) return { error: error.message };
  return { subEvents: data ?? [] };
}

export async function getEventWindow(eventId: string): Promise<{ window?: EventWindow; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('event_windows')
    .select('*')
    .eq('event_id', eventId)
    .single();
  if (error) return { error: error.message };
  return { window: data };
}
