import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import { buildRsvpSummaryPdfHtml } from '@fotosposi/site-builder';
import type { RsvpSummaryEntry } from '@fotosposi/site-builder';

/**
 * GET /api/events/[id]/rsvp/export?format=pdf
 * Lettera riepilogo conferme per gli sposi (PDF via HTML print-friendly).
 * Solo sposo/manager. Il logo del brand viene embeddato come data URI.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function loadLogoDataUri(brand?: string | null): string | null {
  const file = brand === 'weddingmoments' ? 'logo-justmarry-trans.png' : 'logo-sposi-trans.png';
  try {
    const buf = readFileSync(join(process.cwd(), 'public', file));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch (e) {
    console.error(`[rsvp/export] logo '${file}' non trovato:`, e instanceof Error ? e.message : e);
    return null;
  }
}

function buildNumbers(responses: RsvpSummaryEntry[]) {
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
  return { totalResponses: (responses ?? []).length, totalPeople, totalAdults, totalMinors, topIntolerances };
}

export async function GET(
  request: NextRequest,
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

  const { data: responses } = await svc
    .from('rsvp_responses')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  const numbers = buildNumbers((responses as RsvpSummaryEntry[]) ?? []);
  const brand = event?.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
  const logoDataUri = loadLogoDataUri(event?.brand);

  const html = buildRsvpSummaryPdfHtml((responses as RsvpSummaryEntry[]) ?? [], {
    brand,
    coupleName: event?.couple_name ?? '',
    generatedAt: new Date().toISOString(),
    logoDataUri,
  }, numbers);

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
