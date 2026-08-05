import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { listGuests, bumpReminder, dueForReminderToday, buildReminderEmailHtml } from '@fotosposi/invitations';
import {
  brandName,
  brandFromAddress,
  loadLogoDataUri,
  generateQrDataUri,
  ensureEventGuestLink,
} from '@/lib/invitations.server';

/**
 * Cron automatico dei solleciti RSVP (vercel.json ogni giorno alle 04:50 UTC).
 * Per ogni evento con rsvp_auto_reminder=true, se oggi è entro i
 * rsvp_reminder_days_before giorni precedenti alla scadenza RSVP
 * (rsvpDeadline nel site_drafts.content più recente), invia il sollecito ai
 * pending che hanno ancora budget per il loro livello di insistenza e non sono
 * già stati sollecitati oggi. Email via Resend con QR + link + slogan + logo.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results: Array<{ eventId: string; couple: string; attempted: number; sent: number; error?: string }> = [];
  let status: 'ok' | 'warning' | 'error' = 'ok';

  try {
    const now = new Date();
    const { data: events, error: eventsErr } = await supabase
      .from('events')
      .select('id, couple_name, brand, rsvp_auto_reminder, rsvp_reminder_days_before')
      .eq('rsvp_auto_reminder', true);

    if (eventsErr) throw new Error(eventsErr.message);

    for (const event of events ?? []) {
      try {
        // Scadenza RSVP dal site_drafts più recente.
        const { data: draft } = await supabase
          .from('site_drafts')
          .select('content')
          .eq('event_id', event.id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = (draft?.content ?? {}) as Record<string, any>;
        const deadlineRaw = typeof content.rsvpDeadline === 'string' ? content.rsvpDeadline : null;
        if (!deadlineRaw) continue; // niente scadenza → niente sollecito automatico

        const deadline = new Date(deadlineRaw);
        if (Number.isNaN(deadline.getTime())) continue;

        const daysBefore = event.rsvp_reminder_days_before ?? 7;
        const threshold = new Date(deadline.getTime() - daysBefore * 86400000);
        // Finestra: dal giorno "deadline - daysBefore" fino al giorno della scadenza.
        if (now.getTime() < threshold.getTime()) continue;
        if (now.getTime() > deadline.getTime() + 86400000) continue;

        const guests = await listGuests(event.id);
        const due = dueForReminderToday(guests, now);
        if (due.length === 0) {
          results.push({ eventId: event.id, couple: event.couple_name ?? '', attempted: 0, sent: 0 });
          continue;
        }

        const { link, error: linkError } = await ensureEventGuestLink(event.id, event.brand);
        if (linkError) throw new Error(`link evento: ${linkError}`);
        const qrDataUri = await generateQrDataUri(link!);

        const brand = brandName(event.brand);
        const fromAddress = brandFromAddress(event.brand);
        const logoDataUri = loadLogoDataUri(event.brand);
        const coupleName = event.couple_name || 'gli Sposi';

        let sent = 0;
        for (const g of due) {
          if (!g.email) continue;
          const html = buildReminderEmailHtml(g.name, {
            brand,
            coupleName,
            eventLink: link!,
            qrDataUri,
            logoDataUri,
            rsvpDeadline: deadlineRaw,
            message: null,
          });
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
              subject: `Vi aspettiamo! RSVP — ${coupleName}`,
              text,
              html,
            }),
          });
          if (res.ok) {
            await bumpReminder(g.id);
            sent += 1;
          }
        }
        results.push({ eventId: event.id, couple: coupleName, attempted: due.length, sent });
      } catch (e) {
        results.push({
          eventId: event.id,
          couple: event.couple_name ?? '',
          attempted: 0,
          sent: 0,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (results.some((r) => r.error)) status = 'warning';
  } catch (e) {
    status = 'error';
    await supabase.from('system_health_log').insert({
      job: 'rsvp-reminders',
      status: 'error',
      details: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
    });
    return NextResponse.json({ status: 'error', results }, { status: 500 });
  }

  const totalSent = results.reduce((acc, r) => acc + r.sent, 0);
  const totalAttempted = results.reduce((acc, r) => acc + r.attempted, 0);

  await supabase.from('system_health_log').insert({
    job: 'rsvp-reminders',
    status,
    details: JSON.stringify({ events: results.length, attempted: totalAttempted, sent: totalSent }),
  });

  return NextResponse.json({ status, results, totalAttempted, totalSent });
}
