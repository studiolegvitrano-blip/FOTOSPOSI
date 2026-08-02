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

  const [{ data: event }, { data: subEvents }, { data: media }, { data: eventWindow }, { data: draft }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('sub_events').select('*').eq('event_id', eventId).order('date', { ascending: true }),
    supabase.from('media_uploads').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    supabase.from('event_windows').select('*').eq('event_id', eventId).single(),
    supabase.from('site_drafts').select('content').eq('event_id', eventId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!event) {
    return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
  }

  // Arricchisce ogni media con `uploader_name` e `uploader_role_at_event` (stesso pattern di
  // /api/events/[id]/media): così il feed mostra "Mario Rossi — Testimone" sotto ogni foto,
  // non il fallback couple_name. Senza questo gli invitati non sanno CHI ha caricato cosa.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uploaderInfoMap: Record<string, { name?: string; first_name?: string; last_name?: string; role_at_event?: string }> = {};
  if (media && media.length > 0) {
    const uploaderIds = Array.from(new Set(media.map((m: any) => m.uploaded_by).filter(Boolean)));
    if (uploaderIds.length > 0) {
      const { data: uploaders } = await supabase
        .from('core_users')
        .select('id, first_name, last_name, name, role_at_event')
        .in('id', uploaderIds);
      uploaderInfoMap = Object.fromEntries(
        (uploaders ?? []).map((u: any) => [u.id, u]),
      );
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedMedia = (media ?? []).map((m: any) => {
    const u = uploaderInfoMap[m.uploaded_by];
    const uploaderName = u ? (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.name) : undefined;
    return { ...m, uploader_name: uploaderName, uploader_role_at_event: u?.role_at_event ?? null };
  });

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

  // Orari cerimonia/ricevimento dal SiteContent pubblicato (site-builder), come in
  // /api/events/[id]/details — servono al Countdown per il phase detection (11:00/13:00 fallback).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = (draft?.content ?? {}) as Record<string, any>;
  const siteTimes: { ceremonyTime?: string; receptionTime?: string } = {};
  if (typeof content.ceremonyTime === 'string') siteTimes.ceremonyTime = content.ceremonyTime;
  if (typeof content.receptionTime === 'string') siteTimes.receptionTime = content.receptionTime;

  return NextResponse.json({
    event,
    subEvents: subEvents ?? [],
    media: enrichedMedia,
    window: eventWindow ?? null,
    ...siteTimes,
  });
}
