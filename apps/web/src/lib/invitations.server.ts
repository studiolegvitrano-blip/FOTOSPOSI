// Helper server condivisi per il modulo invitations (lista invitati + solleciti).
// Auth sposo/manager, logo brand data URI, generazione QR PNG server-side (qrcode)
// e link evento invitato (stesso pattern della pagina QR: token in core_auth_tokens).
// feature 05/08/2026.

import { cookies } from 'next/headers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';
import { createServerSideClient, createServiceClient } from '@fotosposi/core';

export type BrandName = 'Sposi.live' | 'JustMarry.live';

/** URL pubblico di un evento (guest page /event/[token]) per il brand di dominio. */
export function brandBaseUrl(brand?: string | null): string {
  return brand === 'weddingmoments' ? 'https://www.justmarry.live' : 'https://www.sposi.live';
}

export function brandName(brand?: string | null): BrandName {
  return brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
}

/** Email mittente (info@sposi.live / info@justmarry.live) — regola feature. */
export function brandFromAddress(brand?: string | null): string {
  return brand === 'weddingmoments' ? 'info@justmarry.live' : 'info@sposi.live';
}

export function loadLogoDataUri(brand?: string | null): string | null {
  const file = brand === 'weddingmoments' ? 'logo-justmarry-trans.png' : 'logo-sposi-trans.png';
  try {
    const buf = readFileSync(join(process.cwd(), 'public', file));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    console.error(`[invitations] logo '${file}' non trovato:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Genera un data URI PNG del QR code (server-side, package qrcode). */
export async function generateQrDataUri(url: string): Promise<string> {
  const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1, errorCorrectionLevel: 'M' });
  return dataUrl;
}

/**
 * Crea (o riusa) un token QR valido per l'evento e ritorna il link pubblico
 * `/event/{token}`. Stesso pattern della route POST /api/auth/qr-token.
 */
export async function ensureEventGuestLink(
  eventId: string,
  brand?: string | null,
  maxAgeDays = 30,
): Promise<{ link?: string; error?: string }> {
  const supabase = createServiceClient();
  const rawToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + maxAgeDays);

  const { data, error } = await supabase
    .from('core_auth_tokens')
    .insert({ event_id: eventId, token: rawToken, role: 'invitato', expires_at: expiresAt.toISOString() })
    .select('token')
    .single();

  if (error) return { error: error.message };
  return { link: `${brandBaseUrl(brand)}/event/${data.token}` };
}

/** Autentica e ritorna lo userId, oppure null. */
export async function getServerUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
    const { data } = await supabaseAuth.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Verifica che l'utente sia sposo (events.created_by) o manager (event_managers
 * edit/admin). Ritorna { ok, event?, error? } — se ok=false, error contiene il
 * messaggio e lo status HTTP da restituire.
 */
export async function assertEventManager(
  eventId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string; status?: number; event?: Record<string, unknown> }> {
  const supabase = createServiceClient();
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
  if (!event) return { ok: false, error: 'Evento non trovato', status: 404 };
  if (event.created_by === userId) return { ok: true, event };
  // NB: event_managers non esiste nel DB di produzione, accesso solo allo sposo.
  return { ok: false, error: 'Accesso negato', status: 403 };
}
