import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId, assertEventManager } from '@/lib/invitations.server';
import { updateGuest, deleteGuest } from '@fotosposi/invitations';
import type { InsistLevel, GuestStatus } from '@fotosposi/invitations';

/**
 * PATCH /api/events/[id]/invitations/[guestId] — aggiorna nome/contatti/insistenza/stato.
 * DELETE — rimuove l'invitato dalla lista.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const { id: eventId, guestId } = await params;
  const userId = await getServerUserId();
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const access = await assertEventManager(eventId, userId);
  if (!access.ok) return NextResponse.json({ error: access.error, status: access.status });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const patch: {
    name?: string;
    email?: string | null;
    whatsapp?: string | null;
    insist_level?: InsistLevel;
    status?: GuestStatus;
  } = {};
  if (typeof body.name === 'string') patch.name = body.name;
  if (typeof body.email === 'string') patch.email = body.email;
  if (body.email === null) patch.email = null;
  if (typeof body.whatsapp === 'string') patch.whatsapp = body.whatsapp;
  if (body.whatsapp === null) patch.whatsapp = null;
  if (['low', 'medium', 'high'].includes(String(body.insist_level))) {
    patch.insist_level = body.insist_level as InsistLevel;
  }
  if (['pending', 'confirmed', 'declined'].includes(String(body.status))) {
    patch.status = body.status as GuestStatus;
  }

  const result = await updateGuest(guestId, patch);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ guest: result.guest });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const { id: eventId, guestId } = await params;
  const userId = await getServerUserId();
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const access = await assertEventManager(eventId, userId);
  if (!access.ok) return NextResponse.json({ error: access.error, status: access.status });

  const result = await deleteGuest(guestId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
