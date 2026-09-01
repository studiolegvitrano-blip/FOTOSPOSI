import { createServiceClient } from '@fotosposi/core';
import { processQueueForEvent } from '@/lib/process-queue';

// RIFONDAZIONE 14/08/2026 — logica dello sweep di maintenance ESTRATTA da
// apps/web/src/app/api/cron/maintenance/route.ts per essere riusata anche dalla
// route /api/cron/maintenance-evening (evening sweep, vedi gap #6 cron IT
// sfalsato: i cron attuali girano 04:00-04:50 UTC = 06:00-06:50 IT, quindi le
// foto caricate la sera 22-02 IT restano pending 4-8h senza un sweep notturno).

// Caps keep a single cron run inside Vercel's function time budget even with many
// simultaneous events (e.g. 500 weddings on the same Saturday).
const MAX_EVENTS_PER_RUN = 40;
const ITEMS_PER_EVENT = 5;
const STUCK_PROCESSING_MINUTES = 30;

export interface MaintenanceSweepResult {
  status: 'ok' | 'warning' | 'error';
  stuckRecovered: number;
  eventsSwept: number;
  itemsProcessed: number;
  perEventErrors: Record<string, string>;
  notes: string[];
}

export async function runMaintenanceSweep(jobLabel: string = 'maintenance', source: 'morning' | 'evening' = 'morning'): Promise<MaintenanceSweepResult> {
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
    const eventIds: string[] = (pendingEvents ?? []).map((r: { event_id: string }) => r.event_id);
    const distinctEventIds: string[] = Array.from(new Set(eventIds)).slice(0, MAX_EVENTS_PER_RUN);
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

  const result: MaintenanceSweepResult = {
    status,
    stuckRecovered: stuckItems?.length ?? 0,
    eventsSwept,
    itemsProcessed,
    perEventErrors,
    notes,
  };

  await supabase.from('system_health_log').insert({
    job: jobLabel,
    status,
    details: {
      source,
      stuckRecovered: result.stuckRecovered,
      eventsSwept,
      itemsProcessed,
      perEventErrors,
      notes,
    },
  });

  return result;
}