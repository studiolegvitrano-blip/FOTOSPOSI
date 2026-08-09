import { createServiceClient } from '@fotosposi/core';
import type { PartnerCode } from './service';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = 'SP-';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[(bytes[i] ?? 0) % CODE_ALPHABET.length];
  }
  return code;
}

/** Genera N codici riscattabili per un partner (pacchetto acquistato). */
export async function generatePartnerCodes(
  partnerId: string,
  quantity: number,
  packageSize = 1,
): Promise<{ codes?: PartnerCode[]; error?: string }> {
  const supabase = createServiceClient();
  const rows = Array.from({ length: quantity }, () => ({
    partner_id: partnerId,
    code: generateCode(),
    package_size: packageSize,
    status: 'available' as const,
  }));

  // Unicità best-effort: se collisione (improbabile), l'insert fallisce e ritorna errore.
  const { data, error } = await supabase.from('partner_codes').insert(rows).select();
  if (error) return { error: error.message };
  return { codes: data as PartnerCode[] };
}

/**
 * Riscatta un codice: crea (o aggiorna) un evento white label per il partner.
 * Il codice passa da 'available' a 'used' SOLO se l'evento è creato con successo
 * (best-effort: se l'update finale fallisce il codice resta available e l'evento
 * resta senza partner — l'utente può riprovare).
 */
export async function redeemPartnerCode(params: {
  code: string;
  eventId: string;
  userId: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { data: codeRow, error: codeErr } = await supabase
    .from('partner_codes')
    .select('id, partner_id, status')
    .eq('code', params.code.trim().toUpperCase())
    .maybeSingle();
  if (codeErr) return { error: codeErr.message };
  if (!codeRow) return { error: 'Codice non valido' };
  if (codeRow.status !== 'available') return { error: 'Codice già utilizzato o revocato' };

  // Imposta partner_id sull'evento.
  const { error: evErr } = await supabase
    .from('events')
    .update({ partner_id: codeRow.partner_id as string })
    .eq('id', params.eventId)
    .eq('created_by', params.userId);
  if (evErr) return { error: evErr.message };

  const { error: updErr } = await supabase
    .from('partner_codes')
    .update({
      status: 'used',
      redeemed_event_id: params.eventId,
      redeemed_by: params.userId,
      redeemed_at: new Date().toISOString(),
    })
    .eq('id', codeRow.id as string)
    .eq('status', 'available');
  if (updErr) return { error: updErr.message };

  return { ok: true };
}

export async function listPartnerCodes(partnerId: string): Promise<{ codes?: PartnerCode[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('partner_codes')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { error: error.message };
  return { codes: (data as PartnerCode[]) ?? [] };
}

export async function revokePartnerCode(partnerId: string, codeId: string): Promise<{ ok?: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('partner_codes')
    .update({ status: 'revoked' })
    .eq('id', codeId)
    .eq('partner_id', partnerId)
    .eq('status', 'available');
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Modello ibrido B2B: il partner crea direttamente un evento e il white label
 * viene attivato subito con il PRIMO codice disponibile del suo pacchetto
 * (senza chiedere allo sposo di inserire il codice a mano).
 * Best-effort: se il partner non ha codici available (pacchetto esaurito)
 * l'evento resta normale (nessun white label) — l'utente vede l'avviso.
 */
export async function redeemFirstAvailableCode(params: {
  eventId: string;
  userId: string;
}): Promise<{ ok?: boolean; usedCode?: string; error?: string }> {
  const supabase = createServiceClient();

  const { data: partner, error: pErr } = await supabase
    .from('partners')
    .select('id')
    .eq('user_id', params.userId)
    .maybeSingle();
  if (pErr) return { error: pErr.message };
  if (!partner) return { error: 'Profilo partner non trovato' };

  const { data: codeRow, error: cErr } = await supabase
    .from('partner_codes')
    .select('id, code')
    .eq('partner_id', partner.id as string)
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (cErr) return { error: cErr.message };
  if (!codeRow) return { error: 'Nessun codice disponibile (acquista un pacchetto)' };

  const res = await redeemPartnerCode({
    code: codeRow.code as string,
    eventId: params.eventId,
    userId: params.userId,
  });
  if (res.error) return res;
  return { ok: true, usedCode: codeRow.code as string };
}

/** Eventi white label del partner (per il dashboard: link diretti ai matrimoni). */
export async function listPartnerEvents(partnerId: string): Promise<{ events?: Array<{ id: string; couple_name: string; date: string; location: string | null; code: string | null }>; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('events')
    .select('id, couple_name, date, location, code')
    .eq('partner_id', partnerId)
    .order('date', { ascending: false })
    .limit(100);
  if (error) return { error: error.message };
  return { events: (data ?? []) as Array<{ id: string; couple_name: string; date: string; location: string | null; code: string | null }> };
}
