import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';

export type CapsuleRole = 'couple' | 'guest';

export interface CapsuleAccess {
  userId: string;
  role: CapsuleRole;
  guestId?: string;
  guestName?: string;
}

/**
 * Autorizzazione capsula del tempo: sposo (events.created_by) o delegato
 * (event_managers) → role 'couple'; invitato approvato (event_guests) → role 'guest'.
 * Stesso pattern delle route /api/events/[id]/* (authorize locale + service client).
 */
export async function authorizeCapsuleAccess(eventId: string): Promise<CapsuleAccess | { error: NextResponse }> {
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
    const { data } = await supabaseAuth.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch { /* 401 sotto */ }

  if (!userId) {
    return { error: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) };
  }

  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) {
    return { error: NextResponse.json({ error: 'Evento non trovato' }, { status: 404 }) };
  }

  if (event.created_by === userId) {
    return { userId, role: 'couple' };
  }

  const { data: manager } = await svc
    .from('event_managers')
    .select('permission')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .in('permission', ['edit', 'admin'])
    .maybeSingle();
  if (manager) {
    return { userId, role: 'couple' };
  }

  const { data: guest } = await svc
    .from('event_guests')
    .select('id, name, status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  if (guest && guest.status === 'approved') {
    return { userId, role: 'guest', guestId: guest.id, guestName: guest.name };
  }

  return { error: NextResponse.json({ error: 'Accesso negato: solo sposi, delegati o invitati approvati' }, { status: 403 }) };
}
