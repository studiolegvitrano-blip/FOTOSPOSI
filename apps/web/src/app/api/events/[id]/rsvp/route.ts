import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';

/**
 * GET /api/events/[id]/rsvp — lista conferme presenza per la vista sposi.
 * Solo sposo (events.created_by) o manager con permission edit/admin.
 */

export const runtime = 'nodejs';

async function getUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
    const { data } = await supabaseAuth.auth.getUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const svc = createServiceClient();

  const { data: event } = await svc
    .from('events')
    .select('created_by, couple_name, brand')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) {
    return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
  }

  const isCreator = event.created_by === userId;
  let isManager = false;
  if (!isCreator) {
    const { data: mgr } = await svc
      .from('event_managers')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .in('permission', ['edit', 'admin'])
      .maybeSingle();
    isManager = Boolean(mgr);
  }

  if (!isCreator && !isManager) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 });
  }

  const { data: responses, error } = await svc
    .from('rsvp_responses')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Totale persone confermate = capofamiglia + accompagnatori
  let totalPeople = 0;
  let totalAdults = 0;
  let totalMinors = 0;
  const intoleranceCount = new Map<string, number>();
  for (const r of responses ?? []) {
    totalPeople += 1 + (Array.isArray(r.guests) ? r.guests.length : 0);
    for (const g of Array.isArray(r.guests) ? r.guests : []) {
      if (g.type === 'minor') totalMinors += 1;
      else totalAdults += 1;
    }
    for (const it of Array.isArray(r.host_intolerances) ? r.host_intolerances : []) {
      intoleranceCount.set(it, (intoleranceCount.get(it) ?? 0) + 1);
    }
    for (const g of Array.isArray(r.guests) ? r.guests : []) {
      for (const it of Array.isArray(g.intolerances) ? g.intolerances : []) {
        intoleranceCount.set(it, (intoleranceCount.get(it) ?? 0) + 1);
      }
    }
  }
  const topIntolerances = Array.from(intoleranceCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Email dello sposo per prefill del campo destinatario nell'invio via email.
  let coupleEmail: string | null = null;
  const { data: creator } = await svc
    .from('core_users')
    .select('email')
    .eq('id', event.created_by)
    .maybeSingle();
  coupleEmail = creator?.email ?? null;

  const brand = event?.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';

  return NextResponse.json({
    responses: responses ?? [],
    stats: { totalResponses: (responses ?? []).length, totalPeople, totalAdults, totalMinors, topIntolerances },
    coupleEmail,
    coupleName: event?.couple_name ?? '',
    brand,
  });
}
