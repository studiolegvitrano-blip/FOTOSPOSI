import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { uploadFromBuffer } from '@fotosposi/r2-storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Tables backed up as JSON snapshots. This is a metadata/config backup layered on top of
// Supabase's own managed backups — media files themselves already live durably in R2 + Google
// Drive, so this only needs to cover the DB records that would be painful to lose or recreate.
const BACKUP_TABLES = [
  'events',
  'core_users',
  'core_tenants',
  'site_drafts',
  'orders',
  'event_branding',
  'event_tiers',
  'marketplace_suppliers',
] as const;

function isAuthorized(req: NextRequest): boolean {
  // Vercel Cron sends this header automatically; CRON_SECRET is an extra manual-trigger guard.
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured yet -> don't lock ourselves out during setup
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const dateStr = new Date().toISOString().slice(0, 10);
  const results: Record<string, { rows: number; error?: string }> = {};

  for (const table of BACKUP_TABLES) {
    try {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' });
      if (error) {
        results[table] = { rows: 0, error: error.message };
        continue;
      }
      const json = JSON.stringify(data ?? []);
      const upload = await uploadFromBuffer(
        Buffer.from(json, 'utf-8'),
        `backups/${dateStr}`,
        `${table}.json`,
        'application/json',
      );
      results[table] = { rows: count ?? data?.length ?? 0, error: upload.success ? undefined : upload.error };
    } catch (e) {
      results[table] = { rows: 0, error: e instanceof Error ? e.message : 'Errore sconosciuto' };
    }
  }

  const hasError = Object.values(results).some((r) => r.error);
  await supabase.from('system_health_log').insert({
    job: 'backup',
    status: hasError ? 'error' : 'ok',
    details: { date: dateStr, tables: results },
  });

  return NextResponse.json({ date: dateStr, results, status: hasError ? 'error' : 'ok' });
}
