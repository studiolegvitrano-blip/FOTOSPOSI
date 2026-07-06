import { createClient } from '@fotosposi/core';
import type { Tier } from '@fotosposi/core';
import { calculateWindow } from './index';
import type { WeddingEvent, SubEvent, EventWindow } from './index';

export async function createEvent(params: {
  tenant_id: string;
  created_by: string;
  couple_name: string;
  date: string;
  location: string;
  church?: string;
  church_address?: string;
  church_city?: string;
  venue?: string;
  venue_address?: string;
  venue_city?: string;
  brand: 'fotosposi' | 'weddingmoments';
  tier?: Tier;
  allow_guest_media?: boolean;
  watermark_names?: boolean;
  watermark_text?: string;
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
      church_address: params.church_address,
      church_city: params.church_city,
      venue: params.venue,
      venue_address: params.venue_address,
      venue_city: params.venue_city,
      brand: params.brand,
      tier: params.tier ?? 'free',
      allow_guest_media: params.allow_guest_media ?? true,
      watermark_names: params.watermark_names ?? true,
      watermark_text: params.watermark_text ?? null,
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

  const country = (event.location || 'IT').length === 2 ? event.location : 'IT';
  await generateEventCode(supabase, event.id, country);

  const { data: codeRow } = await supabase
    .from('event_codes')
    .select('code')
    .eq('event_id', event.id)
    .single();
  if (codeRow) event.code = codeRow.code;

  return { event };
}

async function generateEventCode(supabase: any, eventId: string, country: string): Promise<void> {
  const { data: maxRow } = await supabase
    .from('event_codes')
    .select('sequence')
    .eq('country', country)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = (maxRow?.sequence ?? 0) + 1;
  const code = `EV_${country}${String(nextSeq).padStart(3, '0')}`;
  await supabase.from('event_codes').insert({ event_id: eventId, code, country, sequence: nextSeq });
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

export async function getEventByCode(code: string): Promise<{ event?: WeddingEvent; error?: string }> {
  const supabase = createClient();
  const { data: codeRow, error: codeErr } = await supabase
    .from('event_codes')
    .select('event_id')
    .eq('code', code)
    .single();
  if (codeErr || !codeRow) return { error: codeErr?.message || 'Code not found' };
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', codeRow.event_id)
    .single();
  if (error) return { error: error.message };
  if (data) data.code = code;
  return { event: data };
}

/**
 * Aggiorna le impostazioni watermark dell'evento (solo il creatore, via RLS
 * "Creators can update own event" — migrazione 00034). Il logo Sposi.live resta
 * sempre impresso: qui si sceglie solo se/che testo degli sposi aggiungere.
 */
export async function updateEventWatermark(
  eventId: string,
  settings: { watermark_names: boolean; watermark_text?: string | null },
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('events')
    .update({
      watermark_names: settings.watermark_names,
      watermark_text: settings.watermark_names ? (settings.watermark_text?.trim() || null) : null,
    })
    .eq('id', eventId);
  return { error: error?.message };
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
