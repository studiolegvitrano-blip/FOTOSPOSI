import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { validateGuests, validateIntolerances } from './validation';

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

interface RsvpBody {
  eventId?: unknown;
  hostName?: unknown;
  hostIntolerances?: unknown;
  guests?: unknown;
  message?: unknown;
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
