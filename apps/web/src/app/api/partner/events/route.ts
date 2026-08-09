import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@fotosposi/core';
import { createEvent } from '@fotosposi/events';
import { getPartnerByUserId, redeemFirstAvailableCode, listPartnerEvents } from '@fotosposi/partner';
import { cookies } from 'next/headers';

/**
 * Eventi white label del partner (modello ibrido B2B):
 * - GET: lista eventi con partner_id = partner.id (per i link del dashboard)
 * - POST: crea direttamente un evento per conto del partner e attiva subito
 *   il white label riscattando il primo codice disponibile del suo pacchetto.
 */
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerSideClient(() => cookieStore.getAll());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { partner, error: pErr } = await getPartnerByUserId(user.id);
  if (pErr) return NextResponse.json({ error: pErr }, { status: 500 });
  if (!partner) return NextResponse.json({ error: 'Profilo partner non trovato' }, { status: 404 });

  const { events, error } = await listPartnerEvents(partner.id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ events: events ?? [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { coupleName, date, location, church, venue } = body;
  if (!coupleName || !date || !location) {
    return NextResponse.json({ error: 'coupleName, date e location sono obbligatori' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerSideClient(() => cookieStore.getAll());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { partner, error: pErr } = await getPartnerByUserId(user.id);
  if (pErr) return NextResponse.json({ error: pErr }, { status: 500 });
  if (!partner) return NextResponse.json({ error: 'Profilo partner non trovato' }, { status: 404 });

  const { event, error: evErr } = await createEvent({
    tenant_id: user.id,
    created_by: user.id,
    couple_name: coupleName,
    date,
    location,
    church: church || undefined,
    venue: venue || undefined,
    brand: 'fotosposi',
    tier: 'free',
    allow_guest_media: true,
    watermark_names: true,
  });
  if (evErr) return NextResponse.json({ error: evErr }, { status: 500 });
  if (!event) return NextResponse.json({ error: 'Evento non creato' }, { status: 500 });

  // White label immediato col primo codice available (modello ibrido).
  const redeem = await redeemFirstAvailableCode({ eventId: event.id, userId: user.id });
  if (redeem.error) {
    // Non è un errore bloccante: l'evento esiste, solo senza sponsor. L'utente
    // potrà riscattare un codice dopo (o acquistare un pacchetto).
    console.warn('[partner/events] white label non attivato:', redeem.error);
  }

  return NextResponse.json({
    event: { id: event.id, couple_name: event.couple_name, code: event.code },
    whiteLabel: !redeem.error,
    usedCode: redeem.usedCode ?? null,
  });
}
