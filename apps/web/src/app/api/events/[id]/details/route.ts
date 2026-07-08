import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';

/**
 * Server-side event detail resolver for `/events/[id]`.
 *
 * RLS policies on events/sub_events/event_windows are scoped to event owner only,
 * so client-side calls from the browser (anon key) return empty rows for anyone who
 * isnt the creator. This endpoint bypasses RLS via service role and authorises via:
 * - public access (for QR-shared links / kiosk)
 * - creator check (events.created_by)
 * - guest check (event_guests)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: eventId } = await params;
    const svc = createServiceClient();

    let userId: string | null = null;
    try {
      const cookieStore = await cookies();
      const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
      const { data } = await supabaseAuth.auth.getUser();
      userId = data?.user?.id ?? null;
    } catch {
      // public access ok
    }

    const [{ data: event }, { data: subEvents }, { data: evtWindow }] = await Promise.all([
      svc.from('events').select('*').eq('id', eventId).maybeSingle(),
      svc.from('sub_events').select('*').eq('event_id', eventId).order('date', { ascending: true }),
      svc.from('event_windows').select('*').eq('event_id', eventId).maybeSingle(),
    ]);

    if (!event) {
      return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
    }

    // Authorize: no block — any visitor can see event details. Sensitive data
    // (like guest email list) is NOT returned here.
    let isCreator = false;
    let isGuest = false;
    if (userId) {
      isCreator = event.created_by === userId;
      if (!isCreator) {
        const { data: guest } = await svc.from('event_guests').select('id').eq('event_id', eventId).eq('user_id', userId).maybeSingle();
        isGuest = !!guest;
      }
    }

    return NextResponse.json({
      event,
      subEvents: subEvents ?? [],
      window: evtWindow ?? null,
      isCreator,
      isGuest,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}