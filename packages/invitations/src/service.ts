// Lista invitati manuale + solleciti RSVP.
// feature 05/08/2026 (scelta utente): tabella dedicata invited_guests separata
// da event_guests (auto via QR). Le funzioni pure (shouldRemind, MAX_REMINDERS)
// sono testabili; il CRUD passa da createServiceClient come gli altri moduli.

import { createServiceClient } from '@fotosposi/core';

export type InsistLevel = 'low' | 'medium' | 'high';
export type GuestStatus = 'pending' | 'confirmed' | 'declined';

export interface InvitedGuest {
  id: string;
  event_id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  insist_level: InsistLevel;
  status: GuestStatus;
  last_reminder_at: string | null;
  reminder_count: number;
  created_at: string;
}

export interface AddGuestParams {
  name: string;
  email?: string | null;
  whatsapp?: string | null;
  insist_level?: InsistLevel;
  status?: GuestStatus;
}

/** Numero massimo di solleciti per livello di insistenza (scelta feature). */
export const MAX_REMINDERS_BY_LEVEL: Record<InsistLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export const INSIST_LEVELS: InsistLevel[] = ['low', 'medium', 'high'];
export const GUEST_STATUSES: GuestStatus[] = ['pending', 'confirmed', 'declined'];

/**
 * Un invitato deve essere sollecitato se:
 * - status è ancora 'pending' (se ha risposto o è stato declinato, stop)
 * - non ha già raggiunto il massimo di solleciti per il suo livello
 * - (opzionale) l'ultimo sollecito è abbastanza vecchio da non sembrare spam
 */
export function shouldRemind(guest: Pick<InvitedGuest, 'status' | 'reminder_count' | 'insist_level' | 'last_reminder_at'>, now: Date = new Date(), minDaysBetween = 3): boolean {
  if (guest.status !== 'pending') return false;
  const max = MAX_REMINDERS_BY_LEVEL[guest.insist_level] ?? 1;
  if (guest.reminder_count >= max) return false;
  if (guest.last_reminder_at) {
    const last = new Date(guest.last_reminder_at).getTime();
    if (Number.isFinite(last) && now.getTime() - last < minDaysBetween * 86400000) return false;
  }
  return true;
}

/** Crea un guest nella lista invitati dell'evento. Ritorna {guest} o {error}. */
export async function addGuest(eventId: string, params: AddGuestParams): Promise<{ guest?: InvitedGuest; error?: string }> {
  const supabase = createServiceClient();
  const name = (params.name ?? '').trim();
  if (!name) return { error: 'Nome obbligatorio' };
  if (!params.email?.trim() && !params.whatsapp?.trim()) {
    return { error: 'Inserisci almeno email o WhatsApp' };
  }
  const { data, error } = await supabase
    .from('invited_guests')
    .insert({
      event_id: eventId,
      name,
      email: params.email?.trim() || null,
      whatsapp: params.whatsapp?.trim() || null,
      insist_level: params.insist_level ?? 'medium',
      status: params.status ?? 'pending',
    })
    .select()
    .single();
  if (error) return { error: error.message };
  return { guest: data as InvitedGuest };
}

/** Aggiunta batch: tanti invitati in una sola insert (paste da lista). */
export async function addGuestsBatch(eventId: string, rows: AddGuestParams[]): Promise<{ created: number; errors: string[] }> {
  const supabase = createServiceClient();
  const valid = rows
    .filter((r) => (r.name ?? '').trim())
    .map((r) => ({
      event_id: eventId,
      name: r.name.trim(),
      email: r.email?.trim() || null,
      whatsapp: r.whatsapp?.trim() || null,
      insist_level: r.insist_level ?? 'medium',
      status: r.status ?? 'pending',
    }));
  if (valid.length === 0) return { created: 0, errors: ['Nessun invitato valido nella lista'] };
  const { data, error } = await supabase.from('invited_guests').insert(valid).select('id');
  if (error) return { created: 0, errors: [error.message] };
  return { created: (data ?? []).length, errors: [] };
}

export async function listGuests(eventId: string): Promise<InvitedGuest[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('invited_guests')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  return (data as InvitedGuest[]) ?? [];
}

export async function updateGuest(
  guestId: string,
  patch: Partial<Pick<InvitedGuest, 'name' | 'email' | 'whatsapp' | 'insist_level' | 'status'>>,
): Promise<{ guest?: InvitedGuest; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('invited_guests')
    .update({ ...patch, ...(patch.status !== undefined ? { reminder_count: 0, last_reminder_at: null } : {}) })
    .eq('id', guestId)
    .select()
    .single();
  if (error) return { error: error.message };
  return { guest: data as InvitedGuest };
}

export async function deleteGuest(guestId: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('invited_guests').delete().eq('id', guestId);
  if (error) return { error: error.message };
  return { ok: true };
}

/** Incrementa il contatore solleciti di un invitato (dopo invio riuscito). */
export async function bumpReminder(guestId: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('invited_guests')
    .update({ reminder_count: 1, last_reminder_at: new Date().toISOString() })
    .eq('id', guestId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Solleciti che DEVONO partire oggi secondo il cron automatico:
 * per ogni pending che ha ancora budget reminder (shouldRemind) E che non è stato
 * già sollecitato oggi (last_reminder_at non è di oggi), per evitare spam di cron.
 */
export function dueForReminderToday(guests: InvitedGuest[], today: Date = new Date()): InvitedGuest[] {
  const todayStr = today.toISOString().slice(0, 10);
  return guests.filter((g) => {
    if (!shouldRemind(g, today)) return false;
    if (g.last_reminder_at) {
      const lastDay = new Date(g.last_reminder_at).toISOString().slice(0, 10);
      if (lastDay === todayStr) return false;
    }
    return true;
  });
}
