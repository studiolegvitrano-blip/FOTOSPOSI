import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';
import { buildRsvpSummaryPdfHtml } from '@fotosposi/site-builder';
import type { RsvpSummaryEntry } from '@fotosposi/site-builder';

/**
 * POST /api/events/[id]/rsvp/email  body: { to?: string }
 * Invia la lettera riepilogo (allegato HTML print-friendly, identico al PDF
 * scaricabile) agli sposi. Mittente sempre info@sposi.live / info@justmarry.live
 * in base al brand. Se `to` è assente usa l'email di registrazione dello sposo
 * (core_users.email del creatore evento); altrimenti l'indirizzo inserito.
 * Solo sposo/manager.
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
    console.error(`[rsvp/email] logo '${file}' non trovato:`, e instanceof Error ? e.message : e);
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: eventId } = await params;
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  let body: { to?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
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

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email non configurata (RESEND_API_KEY)' }, { status: 503 });
  }

  // Destinatario: body.to se valorizzato e valido, altrimenti email dello sposo.
  let to = (body.to ?? '').trim();
  if (to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ error: 'Indirizzo email non valido' }, { status: 400 });
  }
  if (!to) {
    const { data: creator } = await svc
      .from('core_users')
      .select('email')
      .eq('id', event.created_by)
      .maybeSingle();
    to = creator?.email ?? '';
  }
  if (!to) {
    return NextResponse.json({ error: 'Nessuna email dello sposo trovata' }, { status: 400 });
  }

  const { data: responses } = await svc
    .from('rsvp_responses')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  const list = (responses as RsvpSummaryEntry[]) ?? [];
  const numbers = buildNumbers(list);
  const brand = event?.brand === 'weddingmoments' ? 'JustMarry.live' : 'Sposi.live';
  const fromAddress = event?.brand === 'weddingmoments' ? 'info@justmarry.live' : 'info@sposi.live';
  const logoDataUri = loadLogoDataUri(event?.brand);

  const html = buildRsvpSummaryPdfHtml(list, {
    brand,
    coupleName: event?.couple_name ?? '',
    generatedAt: new Date().toISOString(),
    logoDataUri,
  }, numbers);

  const couple = event?.couple_name || 'gli Sposi';
  const subject = `Conferme di presenza — ${couple}`;
  const summaryText = [
    `Cari Sposi,`,
    `ad oggi le risposte ai vostri inviti sono: ${numbers.totalResponses} conferme (${numbers.totalAdults} adulti, ${numbers.totalMinors} bambini, ${numbers.totalPeople} persone totali).`,
    ``,
    `In allegato la lettera completa con il dettaglio per famiglia e le intolleranze alimentari.`,
    ``,
    `Grazie di aver scelto ${brand}`,
  ].join('\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${brand} <${fromAddress}>`,
      to: [to],
      subject,
      text: summaryText,
      attachments: [
        {
          filename: 'Riepilogo-Conferme.html',
          content: Buffer.from(html).toString('base64'),
          type: 'text/html',
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('[rsvp/email] Resend error:', res.status, detail);
    return NextResponse.json({ error: `Invio email fallito (${res.status})` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, to, brand });
}
