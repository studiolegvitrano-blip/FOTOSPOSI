import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId, assertEventManager } from '@/lib/invitations.server';
import {
  listGuests,
  addGuest,
  addGuestsBatch,
  type InvitedGuest,
  type AddGuestParams,
} from '@fotosposi/invitations';

/**
 * GET /api/events/[id]/invitations — lista invitati + impostazioni sollecito evento.
 * POST /api/events/[id]/invitations — aggiunge 1 invitato ({...}) o una lista
 *   batch ({ guests: AddGuestParams[], replaceAll?: boolean }). Solo sposo/manager.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const userId = await getServerUserId();
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const access = await assertEventManager(eventId, userId);
  if (!access.ok) return NextResponse.json({ error: access.error, status: access.status });

  const guests = await listGuests(eventId);
  return NextResponse.json({
    guests,
    settings: {
      autoReminder: (access.event as { rsvp_auto_reminder?: boolean }).rsvp_auto_reminder ?? false,
      daysBefore: (access.event as { rsvp_reminder_days_before?: number }).rsvp_reminder_days_before ?? 7,
    },
    brand: (access.event as { brand?: string }).brand ?? null,
    coupleName: (access.event as { couple_name?: string }).couple_name ?? '',
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const userId = await getServerUserId();
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const access = await assertEventManager(eventId, userId);
  if (!access.ok) return NextResponse.json({ error: access.error, status: access.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const b = (body ?? {}) as {
    guests?: AddGuestParams[];
    replaceAll?: boolean;
  } & AddGuestParams;

  // Aggiunta batch (paste da lista) — opzionale replaceAll per sostituire l'intera lista.
  if (Array.isArray(b.guests)) {
    const result = await addGuestsBatch(eventId, b.guests);
    if (result.created === 0 && result.errors.length > 0) {
      return NextResponse.json({ error: result.errors[0] }, { status: 400 });
    }
    return NextResponse.json({ created: result.created, errors: result.errors });
  }

  // Aggiunta singola.
  const single = await addGuest(eventId, {
    name: (b as { name?: string }).name ?? '',
    email: (b as { email?: string }).email,
    whatsapp: (b as { whatsapp?: string }).whatsapp,
    insist_level: (b as { insist_level?: AddGuestParams['insist_level'] }).insist_level,
    status: (b as { status?: AddGuestParams['status'] }).status,
  });
  if (single.error) return NextResponse.json({ error: single.error }, { status: 400 });
  return NextResponse.json({ guest: single.guest as InvitedGuest }, { status: 201 });
}
