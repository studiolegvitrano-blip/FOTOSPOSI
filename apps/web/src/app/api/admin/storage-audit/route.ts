import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';
import { objectExists, deleteObject, listObjectsByPrefix } from '@fotosposi/r2-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel hobby: 60s coda max

interface AuditItem {
  r2_key: string;
  event_id: string | null;
  couple_name: string | null;
  queue_id: string | null;
  queue_status: string | null;
  queue_retry: number | null;
  queue_created_at: string | null;
  in_r2: boolean;
  in_media: boolean;
  in_drive: boolean;
  /** 'queue' | 'orphan' — pending/failed della coda vs oggetto R2 senza nulla */
  source: 'queue' | 'orphan';
}

/**
 * GET /api/admin/storage-audit
 *
 * Diagnostica integrità storage per la console admin:
 *  1. Members pending/failed in upload_queue → per ognuno verifica se è in R2, in
 *     media_uploads, e ha drive_file_id (in_drive).
 *  2. Scan orfani R2 sotto "events/" (limitato a 1000 oggetti per timeout):
 *     keys R2 senza corrispondenza né in media_uploads né in upload_queue.
 *
 * Ritorna { items: AuditItem[], generatedAt, stats }.
 * CEO-gated (stesso pattern /api/admin/*).
 */
export async function GET(req: NextRequest) {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!(await verifyCeoSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const svc = createServiceClient();

    // 1) Pending/failed dalla coda (max 200, più recenti per priorità)
    const { data: queueRows } = await svc
      .from('upload_queue')
      .select('id, event_id, r2_key, status, retry_count, created_at')
      .in('status', ['pending', 'failed', 'processing'])
      .order('created_at', { ascending: false })
      .limit(200);

    // 2) Tutti i r2_key già noti (per lookup efficienti in memoria)
    const { data: mediaRows } = await svc
      .from('media_uploads')
      .select('r2_key, drive_file_id')
      .not('r2_key', 'is', null)
      .limit(5000);

    const mediaByR2Key = new Map<string, boolean>();
    const driveByR2Key = new Map<string, boolean>();
    for (const m of (mediaRows ?? []) as Array<{ r2_key: string | null; drive_file_id: string | null }>) {
      if (m.r2_key) {
        mediaByR2Key.set(m.r2_key, true);
        if (m.drive_file_id) driveByR2Key.set(m.r2_key, true);
      }
    }

    // 3) Event couple_name lookup (per leggibilità UI)
    const eventIds = new Set<string>();
    for (const q of (queueRows ?? []) as Array<{ event_id: string | null }>) {
      if (q.event_id) eventIds.add(q.event_id);
    }
    const { data: eventRows } = await svc
      .from('events')
      .select('id, couple_name')
      .in('id', Array.from(eventIds));
    const coupleByEvent = new Map<string, string>();
    for (const e of (eventRows ?? []) as Array<{ id: string; couple_name: string }>) {
      coupleByEvent.set(e.id, e.couple_name);
    }

    // 4) Costruisci items dalla coda
    const items: AuditItem[] = [];
    const knownR2KeysInQueue = new Set<string>();
    for (const q of (queueRows ?? []) as Array<{
      id: string; event_id: string | null; r2_key: string | null;
      status: string; retry_count: number; created_at: string;
    }>) {
      if (!q.r2_key) continue; // senza r2_key non si può verificare nulla
      knownR2KeysInQueue.add(q.r2_key);
      let inR2 = false;
      try { inR2 = await objectExists(q.r2_key); } catch { /* network error, leave false */ }
      const inMedia = mediaByR2Key.has(q.r2_key);
      const inDrive = driveByR2Key.has(q.r2_key);
      items.push({
        r2_key: q.r2_key,
        event_id: q.event_id,
        couple_name: q.event_id ? (coupleByEvent.get(q.event_id) ?? null) : null,
        queue_id: q.id,
        queue_status: q.status,
        queue_retry: q.retry_count,
        queue_created_at: q.created_at,
        in_r2: inR2,
        in_media: inMedia,
        in_drive: inDrive,
        source: 'queue',
      });
    }

    // 5) Scan orfani R2 (limitato per timeout): "events/" + verifica match
    //    Limitiamo a 500 keys totali, per restare nei 60s del Vercel hobby plan.
    //    Per audit estesi usare uno script ad-hoc (TODO futuro: job cron separato).
    const { keys: r2Keys, truncated, error: r2Error } = await listObjectsByPrefix('events/', 500);
    if (r2Error) {
      return NextResponse.json({ error: `R2 list failed: ${r2Error}` }, { status: 502 });
    }
    for (const key of r2Keys) {
      if (knownR2KeysInQueue.has(key)) continue;
      if (mediaByR2Key.has(key)) continue;
      // Orfano: in R2 ma non in coda né in media
      items.push({
        r2_key: key,
        event_id: null,
        couple_name: null,
        queue_id: null,
        queue_status: null,
        queue_retry: null,
        queue_created_at: null,
        in_r2: true, // just listed
        in_media: false,
        in_drive: false,
        source: 'orphan',
      });
    }

    // 6) Stats sintetiche
    const stats = {
      total: items.length,
      pending_in_queue: items.filter((i) => i.source === 'queue').length,
      orphans_r2: items.filter((i) => i.source === 'orphan').length,
      in_media: items.filter((i) => i.in_media).length,
      in_drive: items.filter((i) => i.in_drive).length,
      r2_truncated: truncated,
    };
    return NextResponse.json({ items, stats, generatedAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/storage-audit
 * Body: { action: 'force' | 'delete', r2_key: string }
 *
 * - force: re-inserisce r2_key in upload_queue come pending (se non esiste già,
 *   altrimenti reset retry_count a 0 + status pending). Il cron maintenance
 *   riprocesserà: WATERMARK + INSERT media_uploads + sync Drive.
 * - delete: DELETE da upload_queue (se presente) + DELETE da R2 + log in
 *   system_health_log.job='storage_audit' per auditoria.
 *
 * CEO-gated.
 */
export async function POST(req: NextRequest) {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!(await verifyCeoSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { action?: string; r2_key?: string };
    if (!body.r2_key || !body.action || !['force', 'delete'].includes(body.action)) {
      return NextResponse.json({ error: 'action e r2_key obbligatori' }, { status: 400 });
    }
    const r2Key = body.r2_key;
    const action = body.action as 'force' | 'delete';
    const svc = createServiceClient();

    if (action === 'force') {
      // Cerca se esiste già un row in upload_queue per questo r2_key
      const { data: existing } = await svc
        .from('upload_queue')
        .select('id, event_id, file_name, status, retry_count')
        .eq('r2_key', r2Key)
        .maybeSingle();

      if (existing) {
        // Reset: status=pending, retry_count=0, error=NULL
        const { error } = await svc
          .from('upload_queue')
          .update({ status: 'pending', retry_count: 0, error: null })
          .eq('id', (existing as { id: string }).id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({
          ok: true,
          message: 'Reset pending (retry_count=0)',
          queue_id: (existing as { id: string }).id,
        });
      }

      // Non esiste: crea nuovo row. Servono event_id + file_name. Tentiamo di
      // inferire event_id dal path R2 "events/<r2_folder_name>/..." → confronto
      // con events.r2_folder_name. file_name = basename.
      const r2Folder = r2Key.split('/').slice(0, 2).join('/'); // "events/<folder>"
      const folderName = r2Key.split('/')[1] ?? null;
      const fileName = r2Key.split('/').pop() ?? r2Key;
      let eventId: string | null = null;
      if (folderName) {
        const { data: evRow } = await svc
          .from('events')
          .select('id')
          .eq('r2_folder_name', folderName)
          .maybeSingle();
        if (evRow) eventId = (evRow as { id: string }).id;
      }
      if (!eventId) {
        return NextResponse.json(
          { error: `Impossibile inferire event_id dal path R2 "${r2Folder}". Aggiungi la riga manualmente.` },
          { status: 400 },
        );
      }
      const { data: newRow, error } = await svc
        .from('upload_queue')
        .insert({
          event_id: eventId,
          r2_key: r2Key,
          file_name: fileName,
          status: 'pending',
          retry_count: 0,
        })
        .select('id')
        .single();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({
        ok: true,
        message: 'Re-queued come pending',
        queue_id: (newRow as { id: string }).id,
        inferred_event_id: eventId,
      });
    }

    // action === 'delete'
    // 1) Rimuovi da upload_queue se presente
    const { data: deletedQueue } = await svc
      .from('upload_queue')
      .delete()
      .eq('r2_key', r2Key)
      .select('id');
    // 2) Rimuovi da R2
    let r2Deleted = false;
    try { r2Deleted = await deleteObject(r2Key); } catch { r2Deleted = false; }
    // 3) Log in system_health_log per auditoria
    await svc.from('system_health_log').insert({
      job: 'storage_audit',
      status: 'success',
      details: {
        action: 'delete',
        r2_key: r2Key,
        queue_row_deleted: (deletedQueue ?? []).length,
        r2_deleted: r2Deleted,
      },
    });
    return NextResponse.json({
      ok: true,
      message: `Eliminato da R2: ${r2Deleted ? 'ok' : 'fallito'}. Queue rows rimosse: ${(deletedQueue ?? []).length}.`,
      r2_deleted: r2Deleted,
      queue_rows_removed: (deletedQueue ?? []).length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
