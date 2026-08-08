import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/system
 *
 * Dashboard "stato di sistema" per la console admin: aggregazioni telemetry
 * (system_health_log), stato code di processing (upload_queue + DLQ), ultime
 * esecuzioni cron. Usa il service role per bypassare RLS (i dati sono
 * operativi interni, non esposti via chiave anonima).
 */
export async function GET(_req: NextRequest) {
  try {
    const svc = createServiceClient();

    // Auth: richiede sessione utente (stessa policy delle altre pagine admin).
    const cookieStore = await cookies();
    const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1) Stato code di processing
    const [{ data: queueRows }, { data: dlqRows }, { data: watermarkMissing }] = await Promise.all([
      svc.from('upload_queue').select('status'),
      svc.from('upload_queue_dead_letter').select('id, event_id, file_name, r2_key, last_failure_class, dlq_retry_count, moved_to_dlq_at'),
      svc.from('media_uploads').select('id').eq('watermark_missing', true).limit(1000),
    ]);

    const queueByStatus: Record<string, number> = { pending: 0, processing: 0, failed: 0, synced: 0 };
    for (const row of queueRows ?? []) {
      const s = (row as { status: string }).status;
      queueByStatus[s] = (queueByStatus[s] ?? 0) + 1;
    }

    // 2) Telemetry: aggregazione per failure_class (ultimi 7 gg)
    const { data: failureRows } = await svc
      .from('system_health_log')
      .select('event_id, file_name, failure_class, error_message, retry_count, created_at')
      .eq('job', 'upload_processing_failure')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1000);

    const failuresByClass: Record<string, number> = {};
    const failuresByEvent: Record<string, number> = {};
    const failuresByFile: Record<string, number> = {};
    const recentFailures: Array<Record<string, unknown>> = [];
    for (const row of (failureRows ?? []) as Array<Record<string, unknown>>) {
      const cls = String(row.failure_class ?? 'other');
      failuresByClass[cls] = (failuresByClass[cls] ?? 0) + 1;
      const ev = String(row.event_id ?? 'unknown');
      failuresByEvent[ev] = (failuresByEvent[ev] ?? 0) + 1;
      const fname = String(row.file_name ?? 'unknown');
      failuresByFile[fname] = (failuresByFile[fname] ?? 0) + 1;
      recentFailures.push(row);
    }

    // 3) Eventi top per fallimento — nome coppia per leggibilità
    const topEventIds = Object.keys(failuresByEvent)
      .sort((a, b) => (failuresByEvent[b] ?? 0) - (failuresByEvent[a] ?? 0))
      .slice(0, 10);
    const eventNames: Record<string, string> = {};
    if (topEventIds.length > 0) {
      const { data: evRows } = await svc
        .from('events')
        .select('id, couple_name')
        .in('id', topEventIds);
      for (const e of (evRows ?? []) as Array<{ id: string; couple_name: string }>) {
        eventNames[e.id] = e.couple_name;
      }
    }

    // 4) Ultime esecuzioni cron (backup / maintenance / dlq-retry)
    const lastJobs: Record<string, { status: string; created_at: string; details?: unknown } | null> = {};
    for (const job of ['backup', 'maintenance', 'dlq-retry']) {
      const { data: row } = await svc
        .from('system_health_log')
        .select('status, created_at, details')
        .eq('job', job)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row) {
        lastJobs[job] = {
          status: (row as { status: string }).status,
          created_at: (row as { created_at: string }).created_at,
          details: (row as { details?: unknown }).details,
        };
      } else {
        lastJobs[job] = null;
      }
    }

    // 5) DLQ: totali + per classe + recenti
    const dlqByClass: Record<string, number> = {};
    for (const d of (dlqRows ?? []) as Array<{ last_failure_class: string | null; r2_key?: string | null }>) {
      const cls = d.last_failure_class ?? 'unknown';
      dlqByClass[cls] = (dlqByClass[cls] ?? 0) + 1;
    }
    const dlqRecent = (dlqRows ?? []).slice(0, 20);
    // DLQ items "impossibili": r2_key NULL (file mai arrivato su R2). Non recuperabili,
    // il cron dlq-retry li skippa (guard .filter('r2_key','not.is',null)).
    const dlqUnrecoverable = (dlqRows ?? []).filter((r) => r.r2_key == null).length;

    return NextResponse.json({
      queue: queueByStatus,
      queueTotal: (queueRows ?? []).length,
      deadLetter: {
        total: (dlqRows ?? []).length,
        byClass: dlqByClass,
        recent: dlqRecent,
        unrecoverable: dlqUnrecoverable,
      },
      watermarkMissing: watermarkMissing?.length ?? 0,
      failures: {
        total: (failureRows ?? []).length,
        byClass: failuresByClass,
        byEvent: failuresByEvent,
        byFile: failuresByFile,
        topEvents: topEventIds.map((id) => ({
          eventId: id,
          coupleName: eventNames[id] ?? '—',
          count: failuresByEvent[id],
        })),
        recent: recentFailures.slice(0, 30),
      },
      lastJobs,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[/api/admin/system] crash:', e);
    const err = e instanceof Error ? e : new Error(String(e));
    return NextResponse.json({ error: err.message, stack: err.stack, name: err.name }, { status: 500 });
  }
}
