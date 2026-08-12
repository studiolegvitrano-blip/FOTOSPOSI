import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import { updateEventSocial } from '@fotosposi/events';

/**
 * PATCH /api/events/[id]/social — aggiorna gli handle social della coppia
 *   per share-with-tags: { groom1_social_handle, groom2_social_handle, couple_hashtag }.
 *
 * Autorizzazione: solo sposo (events.created_by) o delegato (event_managers con
 * permesso 'edit' o 'admin'). Stesso pattern di /api/events/[id]/participants.
 *
 * I campi sono stringhe opzionali (nullable). La normalizzazione '@xxx' / '#xxx'
 * NON avviene qui: avviene a runtime nel client share-with-tags (normalizeHandle).
 */
type Params = { params: Promise<{ id: string }> };

async function authorize(eventId: string): Promise<{ userId: string } | { error: NextResponse }> {
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
  if (event.created_by === userId) return { userId };

  const { data: manager } = await svc
    .from('event_managers')
    .select('permission')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .in('permission', ['edit', 'admin'])
    .maybeSingle();
  if (manager) return { userId };

  return { error: NextResponse.json({ error: 'Accesso negato' }, { status: 403 }) };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const auth = await authorize(eventId);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => ({})) as {
    groom1_social_handle?: string | null;
    groom2_social_handle?: string | null;
    couple_hashtag?: string | null;
  };

  // Validazione minimale: stringhe (max 60 char) o null. Nessun formato imposto
  // (la normalizzazione avviene lato client share-with-tags).
  const sanitize = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    return s.slice(0, 60);
  };

  const { error } = await updateEventSocial(eventId, {
    groom1_social_handle: sanitize(body.groom1_social_handle),
    groom2_social_handle: sanitize(body.groom2_social_handle),
    couple_hashtag: sanitize(body.couple_hashtag),
  });
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({
    ok: true,
    groom1_social_handle: sanitize(body.groom1_social_handle),
    groom2_social_handle: sanitize(body.groom2_social_handle),
    couple_hashtag: sanitize(body.couple_hashtag),
  });
}
