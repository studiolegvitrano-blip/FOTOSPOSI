import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { processQueueForEvent } from '../../r2/process-queue/route';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Caps keep a single cron run inside Vercel's function time budget even with many
// simultaneous events (e.g. 500 weddings on the same Saturday).
const MAX_EVENTS_PER_RUN = 40;
const ITEMS_PER_EVENT = 5;
const STUCK_PROCESSING_MINUTES = 30;

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
  const notes: string[] = [];
  let status: 'ok' | 'warning' | 'error' = 'ok';

  // 1) Recover upload_queue items stuck in "processing" (e.g. a previous serverless
  //    invocation crashed/timed out mid-item) so they get retried instead of stalling forever.
  const stuckSince = new Date(Date.now() - STUCK_PROCESSING_MINUTES * 60 * 1000).toISOString();
  const { data: stuckItems, error: stuckErr } = await supabase
    .from('upload_queue')
    .update({ status: 'pending' })
    .eq('status', 'processing')
    .lt('created_at', stuckSince)
    .select('id');

  if (stuckErr) {
    status = 'error';
    notes.push(`Recupero job bloccati fallito: ${stuckErr.message}`);
  } else if (stuckItems && stuckItems.length > 0) {
    status = 'warning';
    notes.push(`${stuckItems.length} job upload_queue bloccati in "processing" ripristinati a "pending"`);
  }

  // 2) Autonomous sweep: process pending/failed upload_queue items across ALL events with
  //    something waiting, not just the ones where a guest happens to have the upload page open.
  const { data: pendingEvents, error: eventsErr } = await supabase
    .from('upload_queue')
    .select('event_id')
    .in('status', ['pending', 'failed'])
    .limit(2000);

  let eventsSwept = 0;
  let itemsProcessed = 0;
  const perEventErrors: Record<string, string> = {};

  if (eventsErr) {
    status = 'error';
    notes.push(`Lettura upload_queue fallita: ${eventsErr.message}`);
  } else {
    const distinctEventIds = Array.from(new Set((pendingEvents ?? []).map((r) => r.event_id))).slice(0, MAX_EVENTS_PER_RUN);
    for (const eventId of distinctEventIds) {
      try {
        const { processed } = await processQueueForEvent(eventId, ITEMS_PER_EVENT);
        itemsProcessed += processed;
        eventsSwept++;
      } catch (e) {
        perEventErrors[eventId] = e instanceof Error ? e.message : 'Errore sconosciuto';
        status = status === 'ok' ? 'warning' : status;
      }
    }
  }

  // 3) Basic connectivity/quota sanity check (cheap query) so an outage shows up in the log
  //    even if nothing else needed attention this run.
  const { error: pingErr } = await supabase.from('events').select('id').limit(1);
  if (pingErr) {
    status = 'error';
    notes.push(`Ping Supabase fallito: ${pingErr.message}`);
  }

  const details = {
    stuckRecovered: stuckItems?.length ?? 0,
    eventsSwept,
    itemsProcessed,
    perEventErrors,
    notes,
  };

  await supabase.from('system_health_log').insert({ job: 'maintenance', status, details });

  return NextResponse.json({ status, ...details });
}
