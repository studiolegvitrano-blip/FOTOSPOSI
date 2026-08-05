import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';

/**
 * POST /api/rsvp — submit conferma presenza dal sito-evento pubblico.
 *
 * Il form è pubblico (nessun login richiesto per gli invitati): la INSERT usa
 * service role. La validazione è lato server per evitare payload malformati.
 *
 * Body:
 * {
 *   eventId: string,
 *   hostName: string,
 *   hostIntolerances?: string[],
 *   guests?: Array<{ name: string; type: 'adult'|'minor'; age?: number|null; intolerances?: string[] }>,
 *   message?: string
 * }
 */

export const runtime = 'nodejs';

interface RsvpGuest {
  name?: unknown;
  type?: unknown;
  age?: unknown;
  intolerances?: unknown;
}

interface RsvpBody {
  eventId?: unknown;
  hostName?: unknown;
  hostIntolerances?: unknown;
  guests?: unknown;
  message?: unknown;
}

const MAX_GUESTS = 15;
const MAX_INTOLERANCES = 10;

function validateIntolerances(raw: unknown): string[] | null {
  if (raw === undefined || raw === null || raw === '') return [];
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') return null;
    const clean = item.trim().slice(0, 80);
    if (clean) out.push(clean);
  }
  if (out.length > MAX_INTOLERANCES) return null;
  return out;
}

function validateGuests(raw: unknown): Array<{
  name: string;
  type: 'adult' | 'minor';
  age: number | null;
  intolerances: string[];
}> | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_GUESTS) return null;
  const out: Array<{ name: string; type: 'adult' | 'minor'; age: number | null; intolerances: string[] }> = [];
  for (const g of raw as RsvpGuest[]) {
    if (!g || typeof g !== 'object') return null;
    const name = typeof g.name === 'string' ? g.name.trim() : '';
    if (!name || name.length > 120) return null;
    const type = g.type === 'minor' ? 'minor' : g.type === 'adult' ? 'adult' : null;
    if (!type) return null;
    let age: number | null = null;
    if (type === 'minor') {
      const n = typeof g.age === 'number' ? g.age : Number(g.age);
      if (!Number.isFinite(n) || n < 0 || n > 18) return null;
      age = Math.floor(n);
    } else if (g.age !== undefined && g.age !== null && g.age !== '') {
      const n = typeof g.age === 'number' ? g.age : Number(g.age);
      if (!Number.isFinite(n) || n < 0) return null;
      age = Math.floor(n);
    }
    const intolerances = validateIntolerances(g.intolerances);
    if (intolerances === null) return null;
    out.push({ name, type, age, intolerances });
  }
  return out;
}

export async function POST(request: NextRequest) {
  let body: RsvpBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  const hostName = typeof body.hostName === 'string' ? body.hostName.trim() : '';
  if (!eventId || !hostName) {
    return NextResponse.json({ error: 'eventId e hostName obbligatori' }, { status: 400 });
  }
  if (hostName.length > 160) {
    return NextResponse.json({ error: 'hostName troppo lungo' }, { status: 400 });
  }

  const hostIntolerances = validateIntolerances(body.hostIntolerances);
  if (hostIntolerances === null) {
    return NextResponse.json({ error: 'intolleranze non valide' }, { status: 400 });
  }
  const guests = validateGuests(body.guests);
  if (guests === null) {
    return NextResponse.json({ error: 'accompagnatori non validi' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : null;

  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('id, brand')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
  }

  const { data, error } = await svc
    .from('rsvp_responses')
    .insert({
      event_id: eventId,
      host_name: hostName,
      host_intolerances: hostIntolerances,
      guests,
      message,
      brand: event.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[rsvp] insert fallita:', error.message);
    return NextResponse.json({ error: 'Errore nel salvataggio della conferma' }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
