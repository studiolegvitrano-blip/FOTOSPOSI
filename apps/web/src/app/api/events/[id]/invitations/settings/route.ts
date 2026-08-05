import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId, assertEventManager } from '@/lib/invitations.server';
import { createServiceClient } from '@fotosposi/core';

/**
 * POST /api/events/[id]/invitations/settings
 * body: { autoReminder?: boolean, daysBefore?: number }
 * Aggiorna la configurazione del sollecito automatico dell'evento
 * (events.rsvp_auto_reminder / events.rsvp_reminder_days_before).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const userId = await getServerUserId();
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const access = await assertEventManager(eventId, userId);
  if (!access.ok) return NextResponse.json({ error: access.error, status: access.status });

  let body: { autoReminder?: boolean; daysBefore?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const patch: { rsvp_auto_reminder?: boolean; rsvp_reminder_days_before?: number } = {};
  if (typeof body.autoReminder === 'boolean') patch.rsvp_auto_reminder = body.autoReminder;
  if (typeof body.daysBefore === 'number' && Number.isFinite(body.daysBefore)) {
    patch.rsvp_reminder_days_before = Math.max(0, Math.min(30, Math.round(body.daysBefore)));
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', eventId)
    .select('rsvp_auto_reminder, rsvp_reminder_days_before')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    settings: { autoReminder: data.rsvp_auto_reminder, daysBefore: data.rsvp_reminder_days_before },
  });
}
