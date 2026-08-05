import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import type { Tier } from '@fotosposi/core';

/**
 * GET /api/events/[id]/tier
 *
 * Ritorna il tier dell'evento lato server (service role, bypassa RLS).
 * La funzione client `getEventTier` in packages/core degrada all'anon key nel
 * browser → le policy RLS su `events` la bloccano → tier sempre 'free' nelle
 * pagine client. Questa route è la fonte server-side affidabile per tier page,
 * games hub e games/manage.
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
  const { data: event, error } = await svc
    .from('events')
    .select('tier')
    .eq('id', eventId)
    .maybeSingle();

  if (error || !event) {
    return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
  }

  return NextResponse.json({ tier: (event.tier as Tier) ?? 'free' });
}
