import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import { cookies } from 'next/headers';
import type { WeddingEvent, EventWindow } from '@fotosposi/events';

/**
 * Server-side init for the upload page. The page previously called getEventById /
 * getEventTier / getEventWindow directly with the anon-key browser client — that fails
 * under RLS for non-creators because policies are scoped to `auth.uid() = created_by`,
 * leaving the page stuck on its <Loader2 /> forever (eventReady never reaches true).
 *
 * This route resolves all data server-side with the service role, validating that the
 * caller is either the event creator or a member of the event's tenant.
 *
 * Returns { event, tier, window } or { error } with status.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'eventId mancante' }, { status: 400 });
  }

  // Validate session server-side via Supabase SSR cookies
  const cookieStore = await cookies();
  const supabaseAuth = createServerSideClient(() => Promise.resolve(
    cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
  ));
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (eventErr || !event) {
    return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
  }

  // Authorization: creator OR invited member of the event's tenant.
  // (core_users.event_id OR core_users.tenant_id == event.tenant_id for collaborators)
  const { data: caller } = await supabase
    .from('core_users')
    .select('id, role, tenant_id, event_id')
    .eq('id', user.id)
    .maybeSingle();

  const isCreator = event.created_by === user.id;
  const isEventMember = !!caller && (
    (caller.event_id === eventId) ||
    (caller.tenant_id === event.tenant_id)
  );
  if (!isCreator && !isEventMember) {
    return NextResponse.json({ error: 'Non autorizzato per questo evento' }, { status: 403 });
  }

  const tier = event.tier as 'free' | 'premium' | 'deluxe' | null;

  // Window only matters for non-creators (creator può uploadare sempre)
  let window: EventWindow | null = null;
  if (!isCreator) {
    const { data: w } = await supabase
      .from('event_windows')
      .select('*')
      .eq('event_id', eventId)
      .maybeSingle();
    window = (w ?? null) as EventWindow | null;
    if (window) {
      const now = new Date();
      if (now < new Date(window.opens_at) || now > new Date(window.closes_at)) {
        return NextResponse.json({ error: 'Finestra di upload chiusa', window }, { status: 409 });
      }
    }
  }

  // Stats for Free tier limit check (sposi skip)
  let stats: { synced: number; pending: number; processing: number } | null = null;
  if (tier === 'free') {
    const { data: rows } = await supabase
      .from('media_uploads')
      .select('status', { count: 'exact' })
      .eq('event_id', eventId)
      .in('status', ['synced', 'pending', 'processing']);
    const synced = (rows ?? []).filter((r: { status: string }) => r.status === 'synced').length;
    const pending = (rows ?? []).filter((r: { status: string }) => r.status === 'pending').length;
    const processing = (rows ?? []).filter((r: { status: string }) => r.status === 'processing').length;
    stats = { synced, pending, processing };
  }

  return NextResponse.json({
    event: event as WeddingEvent,
    tier,
    window,
    isCreator,
    stats,
  });
}
