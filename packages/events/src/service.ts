import { createClient } from '@fotosposi/core';
import type { Tier } from '@fotosposi/core';
import { calculateWindow } from './index';
import type { WeddingEvent, SubEvent, EventWindow } from './index';

/**
 * Costruisce il nome della cartella R2 dedicata all'evento.
 * Formato: `YYYY_MM_DD_Surname1_Surname2` dove le surname derivano da `couple_name`
 * (es. "Guido & Melissa" → "Guido_Melissa"). Caratteri non alfanumerici剥离,
 * lunghezza max 60 per compatibilità filesystem / S3.
 */
export function buildR2FolderName(coupleName: string, date: string): string {
  const datePart = (date || '').replace(/[^0-9-]/g, '').replace(/-/g, '_'); // 2026_08_25
  // Split del couple_name: "&", "e", "and", "+", "/", ","
  const names = (coupleName || '')
    .split(/\s*(?:&|e|and|\+|\/|,)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/[^A-Za-z0-9]/g, '')) // togli accenti/spazi/punteggiatura
    .filter(Boolean);
  const namesPart = names.slice(0, 2).join('_');
  const raw = `${datePart}_${namesPart}`;
  return raw.replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}

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
      r2_folder_name: buildR2FolderName(params.couple_name, params.date),
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
  settings: { watermark_names: boolean; watermark_text?: string | null; watermark_font?: string | null },
): Promise<{ error?: string }> {
  const supabase = createClient();
  const update: Record<string, unknown> = {
    watermark_names: settings.watermark_names,
    watermark_text: settings.watermark_names ? (settings.watermark_text?.trim() || null) : null,
  };
  if (settings.watermark_font) update.watermark_font = settings.watermark_font;
  const { error } = await supabase
    .from('events')
    .update(update)
    .eq('id', eventId);
  return { error: error?.message };
}

/**
 * Aggiorna nome/cognome/role dei due partner (richiesto 27/07/2026 per supportare
 * matrimonio stesso-sesso e watermark con soli nomi). Le colonne sono state aggiunte
 * dalla migration 00038_grooms_first_last_name.sql.
 *
 * NB: aggiorna anche `couple_name` come display name calcolato (es. "Marco Rossi & Luca Bianchi"),
 * perché altri punti del codice (timeline, galleria) lo usano come fallback quando i
 * campi groom* non sono valorizzati.
 */
export async function updateEventNames(
  eventId: string,
  settings: {
    groom1_first_name: string | null;
    groom1_last_name: string | null;
    groom1_role: 'groom' | 'bride';
    groom2_first_name: string | null;
    groom2_last_name: string | null;
    groom2_role: 'groom' | 'bride';
  },
): Promise<{ error?: string; couple_name?: string | null }> {
  const supabase = createClient();
  // Display name auto-calcolato per retrocompatibilità: "Nome Cognome & Nome Cognome"
  const n1 = [settings.groom1_first_name, settings.groom1_last_name].filter(Boolean).join(' ').trim();
  const n2 = [settings.groom2_first_name, settings.groom2_last_name].filter(Boolean).join(' ').trim();
  const coupleName = [n1, n2].filter(Boolean).join(' & ') || null;
  const { error } = await supabase
    .from('events')
    .update({
      groom1_first_name: settings.groom1_first_name,
      groom1_last_name: settings.groom1_last_name,
      groom1_role: settings.groom1_role,
      groom2_first_name: settings.groom2_first_name,
      groom2_last_name: settings.groom2_last_name,
      groom2_role: settings.groom2_role,
      couple_name: coupleName,
    })
    .eq('id', eventId);
  return { error: error?.message, couple_name: coupleName };
}

/**
 * Aggiorna gli handle social della coppia (share-with-tags):
 * `groom1_social_handle`, `groom2_social_handle`, `couple_hashtag`.
 *
 * Tutti i campi sono NULLABLE: passando null si cancella il valore esistente.
 * La funzione NON normalizza (accetta 'lillo' o '@lillo'): la normalizzazione
 * avviene a runtime nel momento in cui si costruisce il testo di share
 * (vedi packages/social-sharing/src/share-with-tags.ts → normalizeHandle).
 *
 * Autorizzazione: la route API chiamante deve verificare events.created_by
 * oppure event_managers.permission in ('edit','admin').
 */
export async function updateEventSocial(
  eventId: string,
  social: {
    groom1_social_handle: string | null;
    groom2_social_handle: string | null;
    couple_hashtag: string | null;
  },
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('events')
    .update({
      groom1_social_handle: social.groom1_social_handle || null,
      groom2_social_handle: social.groom2_social_handle || null,
      couple_hashtag: social.couple_hashtag || null,
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
