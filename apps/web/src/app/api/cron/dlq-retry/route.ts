import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return authHeader === `Bearer ${secret}`;
}

const DLQ_MAX_RETRY = 5;
const DLQ_BATCH_LIMIT = 25;

function computeDlqBackoffMs(retryCount: number): number {
  if (retryCount <= 0) return 0;
  const hours = Math.min(Math.pow(2, retryCount - 1), 24);
  return hours * 3600_000;
}

function dlqBackoffNextDate(retryCount: number): string {
  const ms = computeDlqBackoffMs(retryCount);
  return new Date(Date.now() + ms).toISOString();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const notes: string[] = [];
  let status: 'ok' | 'warning' | 'error' = 'ok';

  try {
    const nowIso = new Date().toISOString();
    const { data: dlqItems, error: dlqErr } = await supabase
      .from('upload_queue_dead_letter')
      .select('*')
      .or(`dlq_next_retry_at.is.null,dlq_next_retry_at.lte.${nowIso}`)
      .lt('dlq_retry_count', DLQ_MAX_RETRY)
      // GUARD: skippa item con r2_key NULL. Sono "invalid_image" dove il file NON è mai
      // arrivato su R2 (cliente ha chiuso il tab prima della PUT, MIME mismatch, ecc.).
      // Non c'è nulla da recuperare: re-queue sarebbero solo re-DLQ in loop infinito.
      // Restano in DLQ come storico, dlq_retry_count non incrementato (max_count ferma il cron).
      // Sintassi PostgREST nativa via `.filter()` (la sintassi .not() ha un bug in supabase-js v2.110).
      .filter('r2_key', 'not.is', null)
      .order('moved_to_dlq_at', { ascending: true })
      .limit(DLQ_BATCH_LIMIT);

    if (dlqErr) {
      status = 'error';
      notes.push(`Lettura DLQ fallita: ${dlqErr.message}`);
      await supabase.from('system_health_log').insert({
        job: 'dlq-retry',
        status,
        details: { notes, error: dlqErr.message },
      });
      return NextResponse.json({ status, notes }, { status: 500 });
    }

    let retried = 0;
    const requeuedIds: string[] = [];
    const stillFailing: string[] = [];

    for (const dlqItem of dlqItems ?? []) {
      const newRetryCount = (dlqItem.dlq_retry_count ?? 0) + 1;

      const requeueId = crypto.randomUUID();
      const { error: requeueErr } = await supabase.from('upload_queue').insert({
        id: requeueId,
        event_id: dlqItem.event_id,
        uploaded_by: dlqItem.uploaded_by,
        file_name: dlqItem.file_name,
        file_type: dlqItem.file_type,
        file_size: dlqItem.file_size,
        r2_key: dlqItem.r2_key,
        status: 'pending',
        retry_count: 0,
        created_at: new Date().toISOString(),
      });

      if (requeueErr) {
        notes.push(`Requeue fallito per DLQ ${dlqItem.id}: ${requeueErr.message}`);
        status = status === 'ok' ? 'warning' : status;
        stillFailing.push(String(dlqItem.id));
        continue;
      }

      retried++;
      requeuedIds.push(requeueId);

      const nextRetryAt = newRetryCount >= DLQ_MAX_RETRY ? null : dlqBackoffNextDate(newRetryCount);

      const { error: updateErr } = await supabase
        .from('upload_queue_dead_letter')
        .update({
          dlq_retry_count: newRetryCount,
          dlq_next_retry_at: nextRetryAt,
        })
        .eq('id', dlqItem.id);

      if (updateErr) {
        notes.push(`Update DLQ ${dlqItem.id} fallito: ${updateErr.message}`);
      }
    }

    await supabase.from('system_health_log').insert({
      job: 'dlq-retry',
      status,
      details: { retried, requeuedIds, stillFailing, notes, dlqItemsConsidered: (dlqItems ?? []).length },
    });

    return NextResponse.json({
      status,
      retried,
      requeued: requeuedIds.length,
      stillFailingCount: stillFailing.length,
      notes,
    });
  } catch (err) {
    status = 'error';
    const msg = err instanceof Error ? err.message : String(err);
    notes.push(`Eccezione DLQ retry: ${msg}`);
    await supabase.from('system_health_log').insert({
      job: 'dlq-retry',
      status,
      details: { notes, error: msg },
    });
    return NextResponse.json({ status, notes }, { status: 500 });
  }
}
