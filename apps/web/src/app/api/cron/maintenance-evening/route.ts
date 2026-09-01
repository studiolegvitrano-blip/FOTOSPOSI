import { NextRequest, NextResponse } from 'next/server';
import { runMaintenanceSweep } from '@/lib/maintenance-sweep';

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

  // RIFONDAZIONE 14/08/2026 — evening sweep (gap #6). I cron originali girano
  // 04:00-04:50 UTC = 06:00-06:50 IT; le foto caricate la sera (22-02 IT)
  // restavano pending 4-8h. Questo secondo sweep (22:00 e 02:00 UTC) chiude il
  // gap. Scrive comunque job='maintenance' nel log così il banner /admin e le
  // metriche eventsSwept continuano a funzionare (source='evening' lo distingue).
  const result = await runMaintenanceSweep('maintenance', 'evening');
  return NextResponse.json({ ...result });
}