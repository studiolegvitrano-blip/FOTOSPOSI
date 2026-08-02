/**
 * FIX 02/08/2026 — item upload_queue senza `r2_key` (file mai arrivato su R2)
 * ora finisce in `upload_queue_dead_letter` invece di restare appeso per sempre
 * in upload_queue con status='failed' e retry_count=99.
 *
 * PRIMA: `r2_key mancante` → update { status:'failed', retry_count:99 } →
 *   - il filtro del cron è `.lt('retry_count', MAX_RETRY_COUNT)` (7) → l'item
 *     NON veniva MAI più ritentato (99 >= 7) → spazzatura permanente in coda;
 *   - la dashboard /admin/system mostrava "N falliti (in retry)" che in realtà
 *     non ritentavano mai.
 *
 * DOPO: `r2_key mancante` → moveToDeadLetter (insert DLQ + delete da
 * upload_queue) → la coda principale resta snella, l'item è tracciato con
 * failure_class='invalid_image' e visibile nella dashboard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const calls: Array<{ op: string; table: string; payload?: any }> = [];

  const item = {
    id: '00000000-0000-0000-0000-000000000001',
    event_id: 'ee2cc954-98d7-4e11-828b-668a52e738e2',
    uploaded_by: null,
    file_name: 'broken.jpg',
    file_type: 'image/jpeg',
    file_size: 100,
    r2_key: null,
    drive_file_id: null,
    retry_count: 99,
    created_at: '2026-07-29T00:00:00Z',
  };

  const event = {
    couple_name: 'Test Couple',
    date: '2026-08-05',
    brand: 'Sposi.live',
    watermark_names: true,
    watermark_text: '',
    watermark_font: 'classico',
    groom1_first_name: 'Mario',
    groom1_last_name: 'Rossi',
    groom2_first_name: 'Luca',
    groom2_last_name: 'Bianchi',
  };

  const tableData: Record<string, { data: any }> = {
    events: { data: event },
    upload_queue: { data: [item] },
  };

  function makeQuery(table: string) {
    const state: { table: string; op?: string; payload?: any } = { table };
    const q: any = {};
    q.then = (resolve: (v: any) => void) => {
      if (state.op) calls.push({ op: state.op, table: state.table, payload: state.payload });
      resolve({ data: state.op ? [] : (tableData[state.table]?.data ?? []), error: null });
    };
    ['select', 'eq', 'in', 'lt', 'gt', 'order', 'limit', 'single', 'maybeSingle', 'or'].forEach((m) => {
      q[m] = (..._args: any[]) => q;
    });
    q.insert = (payload: any) => { state.op = 'insert'; state.payload = payload; return q; };
    q.update = (payload: any) => { state.op = 'update'; state.payload = payload; return q; };
    q.delete = () => { state.op = 'delete'; return q; };
    return q;
  }

  function buildSupabase() {
    return { from: (table: string) => makeQuery(table) };
  }

  return { calls, buildSupabase };
});

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => h.buildSupabase(),
}));

vi.mock('@fotosposi/media', () => ({
  createMediaRecord: async () => ({ error: null }),
  getDriveToken: async () => ({ token: undefined, error: undefined }),
  getEventDriveFolders: async () => ({ folders: null, error: undefined }),
  updateDriveSyncStatus: async () => ({ error: null }),
}));

vi.mock('@fotosposi/r2-storage', () => ({
  getPresignedDownloadUrl: async () => null,
}));

vi.mock('@fotosposi/video-overlay', () => ({
  applyVideoOverlay: async (b: Buffer) => b,
}));

vi.mock('@fotosposi/photo-overlay', () => ({
  applyOverlay: async (b: Buffer) => b,
  detectWatermark: async () => ({ hasWatermark: true, confidence: 1, hasHeart: true }),
}));

vi.mock('@/lib/watermark-fonts', () => ({
  watermarkFontFamily: (f: string) => f,
}));

vi.mock('@/lib/watermark-fonts.server', () => ({
  ensureWatermarkFonts: () => {},
  loadBrandLogo: async () => null,
  loadWatermarkFontBuffer: async () => null,
}));

import { processQueueForEvent } from '../process-queue';

describe('FIX 02/08/2026 — r2_key mancante → DLQ (non più spazzatura in coda)', () => {
  beforeEach(() => {
    h.calls.length = 0;
  });

  it('item senza r2_key viene inserito in upload_queue_dead_letter e cancellato da upload_queue', async () => {
    const result = await processQueueForEvent('ee2cc954-98d7-4e11-828b-668a52e738e2', 5);

    expect(result.processed).toBe(0);
    expect(result.remaining).toBe(1);

    const inserts = h.calls.filter((c) => c.op === 'insert');
    const dlqInsert = inserts.find((c) => c.table === 'upload_queue_dead_letter');
    expect(dlqInsert).toBeTruthy();
    expect(dlqInsert!.payload).toMatchObject({
      event_id: 'ee2cc954-98d7-4e11-828b-668a52e738e2',
      file_name: 'broken.jpg',
      last_failure_class: 'invalid_image',
    });

    const deletes = h.calls.filter((c) => c.op === 'delete');
    expect(deletes.some((c) => c.table === 'upload_queue')).toBe(true);

    const logInsert = inserts.find((c) => c.table === 'system_health_log');
    expect(logInsert).toBeTruthy();
    expect(logInsert!.payload).toMatchObject({
      job: 'upload_processing_failure',
      failure_class: 'invalid_image',
      error_message: 'r2_key mancante',
    });
  });

  it('NON marca più l\'item failed con retry_count=99 (lo lasciava appeso per sempre)', async () => {
    await processQueueForEvent('ee2cc954-98d7-4e11-828b-668a52e738e2', 5);

    const failedUpdates = h.calls.filter(
      (c) => c.op === 'update' && c.table === 'upload_queue' && c.payload?.status === 'failed',
    );
    expect(failedUpdates).toHaveLength(0);

    const retry99 = h.calls.filter((c) => c.op === 'update' && c.table === 'upload_queue' && c.payload?.retry_count === 99);
    expect(retry99).toHaveLength(0);
  });
});
