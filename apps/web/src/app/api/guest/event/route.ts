import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, rateLimit } from '@fotosposi/core';

/**
 * Server-side resolver for the guest QR/link flow (`/event/[code]`).
 *
 * Why this exists: the event/sub_events/event_windows/media_uploads tables only have RLS
 * policies scoped to the event owner (`auth.uid() = created_by`). Guests scanning a QR code
 * are anonymous (or at least not the event owner), so calling the regular anon-key client
 * functions directly from the browser always returns empty results under RLS — which the
 * guest page then shows as "Link non valido o scaduto", even for a perfectly valid token.
 *
 * The fix is to do the token check + data fetch here, server-side, with the service role key
 * (only available server-side — it's stripped from the client bundle). The QR token itself is
 * the access gate: only requests with a valid, non-expired token get data back.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const rl = rateLimit(`guest-event:${ip}`, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  const { code, guestUserId, guestName, guestEmail } = await req.json();
  if (!code) {
    return NextResponse.json({ error: 'code mancante' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: tokenRow, error: tokenError } = await supabase
    .from('core_auth_tokens')
    .select('*')
    .eq('token', code)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'Link non valido o scaduto' }, { status: 404 });
  }

  const eventId = tokenRow.event_id as string;

  const [{ data: event }, { data: subEvents }, { data: media }, { data: eventWindow }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('sub_events').select('*').eq('event_id', eventId).order('date', { ascending: true }),
    supabase.from('media_uploads').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('event_windows').select('*').eq('event_id', eventId).single(),
  ]);

  if (!event) {
    return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
  }

  if (guestUserId) {
    const { data: eventRow } = await supabase.from('events').select('guest_approval_mode').eq('id', eventId).single();
    const status = eventRow?.guest_approval_mode === 'manual' ? 'pending' : 'approved';
    await supabase
      .from('event_guests')
      .upsert(
        { event_id: eventId, user_id: guestUserId, name: guestName || 'Ospite', email: guestEmail, status },
        { onConflict: 'event_id,user_id' },
      );
  }

  return NextResponse.json({
    event,
    subEvents: subEvents ?? [],
    media: media ?? [],
    window: eventWindow ?? null,
  });
}
