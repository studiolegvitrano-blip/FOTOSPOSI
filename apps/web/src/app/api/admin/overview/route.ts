import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/overview
 *
 * Pagina /admin (pannello di gestione): elenco eventi recenti + utenti.
 * Protetta da sessione CEO (cookie HMAC), stesso pattern di /api/admin/system
 * e /api/ceo/overview. Usa il service role per bypassare RLS.
 */
export async function GET(req: NextRequest) {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!(await verifyCeoSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const svc = createServiceClient();

    const [{ data: events }, { data: users }, { data: queueRows }, { data: lastJobsRows }] = await Promise.all([
      svc.from('events').select('id, couple_name, date, location, tier, brand, created_at').order('created_at', { ascending: false }).limit(50),
      svc.from('core_users').select('id, first_name, last_name, name, email, role, role_at_event, created_at').limit(50),
      // Per banner stallo coda: sommario per status + min created_at sui pending
      svc.from('upload_queue').select('status, created_at'),
      // Ultime 2 esecuzioni maintenance per calcolare eventsSwept=0 per 2 cicli consecutivi
      svc.from('system_health_log')
        .select('status, created_at, details')
        .eq('job', 'maintenance')
        .order('created_at', { ascending: false })
        .limit(2),
    ]);

    // --- Metriche stallo coda (per banner rosso su /admin) ---
    const queueByStatus: Record<string, number> = { pending: 0, processing: 0, failed: 0, synced: 0 };
    let oldestPendingAt: string | null = null;
    for (const row of (queueRows ?? []) as Array<{ status: string; created_at: string }>) {
      const s = row.status;
      queueByStatus[s] = (queueByStatus[s] ?? 0) + 1;
      if (s === 'pending') {
        if (!oldestPendingAt || row.created_at < oldestPendingAt) oldestPendingAt = row.created_at;
      }
    }
    const pendingCount = queueByStatus.pending ?? 0;
    const stalePendingMinutes = oldestPendingAt
      ? Math.floor((Date.now() - new Date(oldestPendingAt).getTime()) / 60000)
      : 0;
    const pendingStalled = pendingCount > 0 && stalePendingMinutes >= 30;

    // eventsSwept=0 per 2 cicli cron maintenance consecutivi
    const lastTwo = (lastJobsRows ?? []) as Array<{ status: string; details?: Record<string, unknown> }>;
    const extractEventsSwept = (r?: { details?: Record<string, unknown> }): number | null => {
      if (!r?.details) return null;
      const v = r.details.eventsSwept;
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
      return null;
    };
    const lastEventsSwept = lastTwo[0] ? extractEventsSwept(lastTwo[0]) : null;
    const prevEventsSwept = lastTwo[1] ? extractEventsSwept(lastTwo[1]) : null;
    const twoCyclesZeroSwept =
      lastEventsSwept !== null && lastEventsSwept === 0 &&
      prevEventsSwept !== null && prevEventsSwept === 0;

    return NextResponse.json({
      events: events ?? [],
      users: users ?? [],
      counts: {
        events: events?.length ?? 0,
        users: users?.length ?? 0,
      },
      queueHealth: {
        pendingCount,
        processingCount: queueByStatus.processing ?? 0,
        failedCount: queueByStatus.failed ?? 0,
        syncedCount: queueByStatus.synced ?? 0,
        oldestPendingAt,
        stalePendingMinutes,
        pendingStalled,
        lastEventsSwept,
        prevEventsSwept,
        twoCyclesZeroSwept,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
