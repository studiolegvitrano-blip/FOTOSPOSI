import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId, assertEventManager, brandName, brandFromAddress, loadLogoDataUri, generateQrDataUri, ensureEventGuestLink } from '@/lib/invitations.server';
import { listGuests, bumpReminder, buildReminderEmailHtml } from '@fotosposi/invitations';
import { createServiceClient } from '@fotosposi/core';
import { sendNotification } from '@fotosposi/notifications';
import type { InvitedGuest } from '@fotosposi/invitations';

/**
 * POST /api/events/[id]/invitations/remind
 * body: { guestIds?: string[], allPending?: boolean, message?: string }
 * Invia ora il sollecito RSVP (email via Resend per chi ha l'email; WhatsApp per
 * chi ha solo il numero) a tutti i guest selezionati o ai pending non ancora a
 * budget massimo. Ogni email contiene QR code + link evento + slogan + logo brand.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const userId = await getServerUserId();
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const access = await assertEventManager(eventId, userId);
  if (!access.ok) return NextResponse.json({ error: access.error, status: access.status });
  const event = access.event as Record<string, unknown>;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email non configurata (RESEND_API_KEY mancante)' }, { status: 503 });
  }

  let body: { guestIds?: string[]; allPending?: boolean; message?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const all = await listGuests(eventId);
  let targets: InvitedGuest[] = [];
  if (Array.isArray(body.guestIds) && body.guestIds.length > 0) {
    targets = all.filter((g) => body.guestIds!.includes(g.id));
  } else if (body.allPending) {
    targets = all.filter((g) => g.status === 'pending');
  } else {
    return NextResponse.json({ error: 'Specifica guestIds o allPending' }, { status: 400 });
  }
  if (targets.length === 0) {
    return NextResponse.json({ error: 'Nessun invitato da sollecitare' }, { status: 400 });
  }

  const brand = brandName(event?.brand as string | null);
  const fromAddress = brandFromAddress(event?.brand as string | null);
  const logoDataUri = loadLogoDataUri(event?.brand as string | null);
  const coupleName = String(event?.couple_name || 'gli Sposi');

  const { link, error: linkError } = await ensureEventGuestLink(eventId, event?.brand as string | null);
  if (linkError) {
    return NextResponse.json({ error: `Impossibile generare link evento: ${linkError}` }, { status: 500 });
  }
  const qrDataUri = await generateQrDataUri(link!);

  // rsvpDeadline dal site_drafts più recente (come la route details).
  const svc = createServiceClient();
  const { data: draft } = await svc
    .from('site_drafts')
    .select('content')
    .eq('event_id', eventId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content = (draft?.content ?? {}) as Record<string, any>;
  const rsvpDeadline = typeof content.rsvpDeadline === 'string' ? content.rsvpDeadline : null;

  const results: Array<{ id: string; name: string; channel: string; ok: boolean; error?: string }> = [];

  for (const g of targets) {
    // Email: Resend diretto con HTML (QR + link + slogan + logo).
    if (g.email) {
      const html = buildReminderEmailHtml(g.name, {
        brand,
        coupleName,
        eventLink: link!,
        qrDataUri,
        logoDataUri,
        rsvpDeadline,
        message: body.message ?? null,
      });
      const subject = `Vi aspettiamo! RSVP — ${coupleName}`;
      const text = `Cari ${g.name}, vi aspettiamo al matrimonio di ${coupleName}! Confermate la presenza qui: ${link}`;
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${brand} <${fromAddress}>`,
          to: [g.email],
          subject,
          text,
          html,
        }),
      });
      const ok = res.ok;
      results.push({ id: g.id, name: g.name, channel: 'email', ok, error: ok ? undefined : `HTTP ${res.status}` });
      if (ok) await bumpReminder(g.id);
      continue;
    }

    // Solo WhatsApp: testo con link (niente QR, il provider non supporta immagini).
    if (g.whatsapp) {
      const bodyText = `Cari ${g.name}, vi aspettiamo al matrimonio di ${coupleName}! Confermate la presenza qui: ${link}`;
      const wa = await sendNotification({ event_id: eventId, channel: 'whatsapp', recipient: g.whatsapp, subject: undefined, body: bodyText });
      const ok = !wa.error && wa.log?.status === 'sent';
      results.push({ id: g.id, name: g.name, channel: 'whatsapp', ok, error: ok ? undefined : (wa.error ?? wa.log?.error ?? 'WhatsApp non inviato') });
      if (ok) await bumpReminder(g.id);
      continue;
    }

    results.push({ id: g.id, name: g.name, channel: 'none', ok: false, error: 'Nessun contatto (email o WhatsApp)' });
  }

  const sent = results.filter((r) => r.ok);
  return NextResponse.json({
    total: results.length,
    sent: sent.length,
    failed: results.length - sent.length,
    results,
    link: link,
  });
}
