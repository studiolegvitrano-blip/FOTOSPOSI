import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { listObjectsWithSizes } from '@fotosposi/r2-storage';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/ceo/overview
 *
 * Console CEO: aggregazione operativa/finanziaria. Protetta da sessione CEO
 * (cookie firmato, password env CEO_PASSWORD). Nessun dato sensibile oltre a
 * quelli già visibili in /admin — ma la verifica del cookie è severa.
 *
 * Sezioni:
 * - events: rubrica eventi con dati per-evento (media, memoria, Drive, R2).
 * - storage: memoria totale R2 (oggetti + byte, per prefisso), Supabase (via
 *   RPC get_table_sizes), stima "Vercel" (derivata da DB — non esiste API free).
 * - economic: ordini (totali, per status), ricavi stimati per tier.
 * - r2: controlli integrità (file in media_uploads senza oggetto R2 → cancellati;
 *   oggetti R2 senza record → orfani).
 */
export async function GET(req: NextRequest) {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!(await verifyCeoSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const svc = createServiceClient();

    // ── 1) Rubrica eventi ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events } = (await svc.from('events').select('*').order('created_at', { ascending: false })) as { data: any[] | null };

    // ── 2) Media per evento + stato Drive ─────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: media } = (await svc
      .from('media_uploads')
      .select('id, event_id, type, drive_file_id, drive_sync_status, r2_key, original_r2_key, watermark_missing, created_at')
      .limit(20000)) as { data: any[] | null };

    const mediaByEvent = new Map<string, typeof media>();
    const r2KeysInDb = new Set<string>();
    for (const m of media ?? []) {
      if (!mediaByEvent.has(m.event_id)) mediaByEvent.set(m.event_id, []);
      mediaByEvent.get(m.event_id)!.push(m);
      if (m.r2_key) r2KeysInDb.add(m.r2_key);
    }

    // ── 3) R2: oggetti con dimensione ────────────────────────────────────
    const eventsObj = await listObjectsWithSizes('events/', 200000);
    const originalsObj = await listObjectsWithSizes('originals/', 200000);
    const allObj = [...(eventsObj.objects ?? []), ...(originalsObj.objects ?? [])];
    const r2KeysSet = new Set(allObj.map((o) => o.key));
    const r2BytesTotal = allObj.reduce((acc, o) => acc + (o.size ?? 0), 0);

    // Dimensioni per prefisso evento (per rubrica: memoria occupata per evento)
    const bytesByEventPrefix = new Map<string, number>();
    for (const o of allObj) {
      const seg = o.key.split('/');
      if (seg.length >= 3) {
        // events/YYYY_MM_.../file o events/<uuid>/file
        const prefix = seg[0] + '/' + seg[1];
        bytesByEventPrefix.set(prefix, (bytesByEventPrefix.get(prefix) ?? 0) + (o.size ?? 0));
      }
    }

    // ── 4) Controllo integrità R2: file in DB senza oggetto (cancellati) ──
    const missingInR2: Array<{ id: string; event_id: string; r2_key: string }> = [];
    for (const m of media ?? []) {
      if (m.r2_key && !r2KeysSet.has(m.r2_key)) {
        missingInR2.push({ id: m.id, event_id: m.event_id, r2_key: m.r2_key });
      }
    }

    // ── 5) Economico: ordini ─────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orders } = (await svc
      .from('orders')
      .select('id, event_id, user_id, total, currency, status, created_at')
      .limit(20000)) as { data: any[] | null };

    const ordersByStatus: Record<string, number> = {};
    let paidRevenueCents = 0;
    const revenueByCurrency: Record<string, number> = {};
    for (const o of orders ?? []) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;
      if (o.status === 'paid' || o.status === 'succeeded' || o.status === 'completed') {
        paidRevenueCents += o.total ?? 0;
        revenueByCurrency[o.currency] = (revenueByCurrency[o.currency] ?? 0) + (o.total ?? 0);
      }
    }

    // Ricavi stimati per tier (prezzi pubblici IT) — solo eventi che NON hanno ordini
    const TIER_PRICES_CENTS: Record<string, number> = { premium: 22900, deluxe: 37500, free: 0 };
    const eventsByTier: Record<string, number> = {};
    let estimatedRevenueCents = 0;
    for (const e of events ?? []) {
      const tier = (e.tier as string) ?? 'free';
      eventsByTier[tier] = (eventsByTier[tier] ?? 0) + 1;
      estimatedRevenueCents += TIER_PRICES_CENTS[tier] ?? 0;
    }

    // ── 6) Supabase: dimensioni tabelle ──────────────────────────────────
    let supabaseTables: Array<{ table_name: string; total_bytes: number; human_size: string }> = [];
    try {
      const { data: tableSizes } = await svc.rpc('get_table_sizes');
      supabaseTables = (tableSizes ?? []) as typeof supabaseTables;
    } catch {
      supabaseTables = [];
    }
    const supabaseBytes = supabaseTables.reduce((acc, t) => acc + (Number(t.total_bytes) || 0), 0);

    // ── 7) Composizione risposta per-evento ──────────────────────────────
    const eventRows = (events ?? []).map((e) => {
      const m = mediaByEvent.get(e.id) ?? [];
      const photos = m.filter((x) => x.type === 'photo').length;
      const videos = m.filter((x) => x.type === 'video').length;
      const driveSynced = m.filter((x) => x.drive_sync_status === 'synced').length;
      const drivePending = m.filter((x) => x.drive_sync_status === 'pending').length;
      const driveFailed = m.filter((x) => x.drive_sync_status === 'failed').length;
      const driveNoStatus = m.length - driveSynced - drivePending - driveFailed;
      const driveWithFileId = m.filter((x) => x.drive_file_id).length;

      // r2_folder_name legacy: "events/YYYY_.../..." o "events/<uuid>/..."
      const folderPrefix = e.r2_folder_name
        ? `events/${e.r2_folder_name}`
        : `events/${e.id}`;
      const eventBytes = bytesByEventPrefix.get(folderPrefix) ?? 0;
      const eventObjectCount = allObj.filter((o) => o.key.startsWith(folderPrefix)).length;

      const eventMissing = missingInR2.filter((x) => x.event_id === e.id);

      return {
        id: e.id,
        coupleName: e.couple_name,
        date: e.date,
        location: e.location,
        tier: e.tier,
        brand: e.brand,
        createdAt: e.created_at,
        r2Folder: folderPrefix,
        media: { total: m.length, photos, videos },
        drive: { synced: driveSynced, pending: drivePending, failed: driveFailed, noStatus: driveNoStatus, withFileId: driveWithFileId },
        storage: { bytes: eventBytes, objects: eventObjectCount },
        r2: {
          missingInR2: eventMissing.map((x) => ({ id: x.id, r2Key: x.r2_key })),
        },
      };
    });

    // Oggetti R2 senza record in media_uploads (orfani) — solo sotto events/
    const orphanKeys = (eventsObj.objects ?? [])
      .map((o) => o.key)
      .filter((k) => !r2KeysInDb.has(k));

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      counts: {
        events: (events ?? []).length,
        mediaTotal: (media ?? []).length,
        ordersTotal: (orders ?? []).length,
      },
      events: eventRows,
      storage: {
        r2: {
          totalObjects: allObj.length,
          totalBytes: r2BytesTotal,
          eventsObjects: (eventsObj.objects ?? []).length,
          eventsBytes: eventsObj.objects?.reduce((a, o) => a + o.size, 0) ?? 0,
          originalsObjects: (originalsObj.objects ?? []).length,
          originalsBytes: originalsObj.objects?.reduce((a, o) => a + o.size, 0) ?? 0,
          truncated: eventsObj.truncated || originalsObj.truncated,
          error: eventsObj.error || originalsObj.error || undefined,
        },
        supabase: {
          totalBytes: supabaseBytes,
          tables: supabaseTables,
        },
        // Vercel non espone usage via API free: stimato dai dati DB (media + code).
        vercelEstimate: {
          note: 'Stima derivata dal DB (non esiste API Vercel free). Baseline: 2.6 MB build + runtime.',
        },
      },
      economic: {
        orders: {
          total: (orders ?? []).length,
          byStatus: ordersByStatus,
          paidRevenueCents,
          paidRevenueByCurrency: revenueByCurrency,
        },
        estimated: {
          eventsByTier,
          estimatedRevenueCents,
        },
      },
      integrity: {
        mediaMissingInR2: missingInR2.length,
        r2OrphanObjects: orphanKeys.slice(0, 500),
        r2OrphanCount: orphanKeys.length,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
