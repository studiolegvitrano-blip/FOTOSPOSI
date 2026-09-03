import { describe, it, expect, vi, beforeEach } from 'vitest';

// RIFONDAZIONE 14/08/2026 — test della solidità del claim atomico + backoff
// reale. Le colonne next_retry_at/failure_class/permanent_failure sono scrivibili
// su upload_queue; verifico che un fallimento scriva next_retry_at (backoff) e
// che il claim avvenga via RPC (no update status='processing' inline).

const h = vi.hoisted(() => {
  const calls: Array<{ op: string; table: string; payload?: any; args?: any }> = [];
  const rpcCalls: Array<{ fname: string; args: any }> = [];

  const item = {
    id: '00000000-0000-0000-0000-0000000000aa',
    event_id: 'ee2cc954-98d7-4e11-828b-668a52e738e2',
    uploaded_by: null,
    file_name: 'photo.jpg',
    file_type: 'image/jpeg',
    file_size: 100,
    r2_key: 'events/folder/photo.jpg',
    drive_file_id: null,
    retry_count: 1,
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
  };

  function rpcClaim(fname: string, args: any) {
    rpcCalls.push({ fname, args });
    if (fname === 'claim_upload_queue_items') {
      return Promise.resolve({ data: [item], error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  function makeQuery(table: string) {
    const state: { table: string; op?: string; payload?: any } = { table };
    const q: any = {};
    q.then = (resolve: (v: any) => void) => {
      if (state.op) calls.push({ op: state.op, table: state.table, payload: state.payload });
      resolve({ data: state.op ? [] : (tableData[state.table]?.data ?? []), error: null });
    };
    ['select', 'eq', 'in', 'lt', 'gt', 'order', 'limit', 'single', 'maybeSingle', 'or', 'not', 'filter'].forEach((m) => {
      q[m] = (..._args: any[]) => q;
    });
    q.insert = (payload: any) => { state.op = 'insert'; state.payload = payload; return q; };
    q.update = (payload: any) => { state.op = 'update'; state.payload = payload; return q; };
    q.delete = () => { state.op = 'delete'; return q; };
    return q;
  }

  function buildSupabase() {
    return { from: (table: string) => makeQuery(table), rpc: rpcClaim };
  }

  return { calls, rpcCalls, buildSupabase };
});

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => h.buildSupabase(),
}));

vi.mock('@fotosposi/media', () => ({
  createMediaRecord: async () => ({ error: null }),
  getDriveToken: async () => ({ token: undefined, error: undefined }),
  getEventDriveFolders: async () => ({ folders: null, error: undefined }),
  updateDriveSyncStatus: async () => ({ error: null }),
  classifyError: (e: unknown) => (e instanceof Error ? e.message : String(e)).toLowerCase().includes('r2') ? 'r2_download_failed' : 'other',
  FAILURE_CLASS_R2_DOWNLOAD: 'r2_download_failed',
  FAILURE_CLASS_WATERMARK: 'watermark_apply_failed',
  FAILURE_CLASS_DRIVE: 'drive_sync_failed',
  FAILURE_CLASS_DETECT: 'detect_watermark_missing',
  FAILURE_CLASS_INVALID: 'invalid_image',
  FAILURE_CLASS_DB: 'db_write_failed',
  FAILURE_CLASS_OTHER: 'other',
}));

vi.mock('@fotosposi/r2-storage', () => ({
  // Restituisce null → il download R2 fallisce → l'item entra nel path di fallimento.
  getPresignedDownloadUrl: async () => null,
  getPresignedUploadUrl: async () => ({ success: false, error: 'no r2' }),
}));

vi.mock('@fotosposi/video-overlay', () => ({
  applyVideoOverlay: async (b: Buffer) => b,
  applyVideoOverlayRemote: async () => ({ ok: false, error: 'no vps' }),
  brandingToRemote: (b: unknown) => b,
  isVpsWatermarkConfigured: () => false,
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

describe('RIFONDAZIONE 14/08/2026 — claim atomico + backoff reale', () => {
  beforeEach(() => {
    h.calls.length = 0;
    h.rpcCalls.length = 0;
  });

  it('il claim avviene via RPC (claim_upload_queue_items) con p_event_id e p_limit', async () => {
    await processQueueForEvent('ee2cc954-98d7-4e11-828b-668a52e738e2', 5);

    const claimCall = h.rpcCalls.find((c) => c.fname === 'claim_upload_queue_items');
    expect(claimCall).toBeTruthy();
    expect(claimCall!.args).toMatchObject({
      p_event_id: 'ee2cc954-98d7-4e11-828b-668a52e738e2',
      p_limit: 5,
    });
  });

  it('nessun update status=processing inline (il claim è nella RPC)', async () => {
    await processQueueForEvent('ee2cc954-98d7-4e11-828b-668a52e738e2', 5);

    const processingUpdates = h.calls.filter(
      (c) => c.op === 'update' && c.table === 'upload_queue' && c.payload?.status === 'processing',
    );
    expect(processingUpdates).toHaveLength(0);
  });

  it('un fallimento scrive next_retry_at (backoff reale) e failure_class sull\'item', async () => {
    await processQueueForEvent('ee2cc954-98d7-4e11-828b-668a52e738e2', 5);

    // Il download R2 fallisce (getPresignedDownloadUrl → null) → markItemFailed
    // scrive status='failed' con next_retry_at e failure_class.
    const failedUpdates = h.calls.filter(
      (c) => c.op === 'update' && c.table === 'upload_queue' && c.payload?.status === 'failed',
    );
    expect(failedUpdates.length).toBeGreaterThan(0);

    const last = failedUpdates[failedUpdates.length - 1]!;
    expect(last.payload).toMatchObject({
      status: 'failed',
      failure_class: 'r2_download_failed',
    });
    expect(last.payload.next_retry_at).toBeTruthy();
    // backoff per retry_count 1 → newRetry=2 → computeProcessingBackoffMs(2)=2000ms nel futuro
    const nextRetryMs = new Date(last.payload.next_retry_at).getTime();
    expect(nextRetryMs).toBeGreaterThan(Date.now());
  });
});