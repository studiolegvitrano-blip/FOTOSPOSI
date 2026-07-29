import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

function buildChain(data: any, error: any = null) {
  const chain: any = {
    data, error,
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(chain)),
    maybeSingle: vi.fn(() => Promise.resolve(chain)),
    in: vi.fn(() => chain),
    update: vi.fn(() => chain),
  };
  return chain;
}

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

vi.mock('@fotosposi/r2-storage', () => ({
  getPresignedUploadUrl: vi.fn(),
  deleteObject: vi.fn(),
  uploadFromBuffer: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const {
  createMediaRecord,
  getMediaByEvent,
  getCuratedMediaByEvent,
  uploadToR2,
  deleteFromR2,
  updateDriveSyncStatus,
  createVideoMessage,
  getVideoMessages,
} = await import('../service');

describe('createMediaRecord', () => {
  it('crea un record media e lo ritorna', async () => {
    const mockMedia = { id: 'm1', event_id: 'evt1', uploaded_by: 'u1', type: 'photo', url: 'url', drive_sync_status: 'pending', created_at: new Date().toISOString() };
    const chain = buildChain(mockMedia);
    mockFrom.mockReturnValue(chain);
    const result = await createMediaRecord({ event_id: 'evt1', uploaded_by: 'u1', type: 'photo', url: 'url' });
    expect(result.media?.id).toBe('m1');
  });

  it('ritorna errore se insert fallisce', async () => {
    const chain = buildChain(null, { message: 'DB error' });
    mockFrom.mockReturnValue(chain);
    const result = await createMediaRecord({ event_id: 'evt1', uploaded_by: 'u1', type: 'photo', url: 'url' });
    expect(result.error).toBe('DB error');
  });

  it('accetta sub_event_id opzionale', async () => {
    const mockMedia = { id: 'm2', event_id: 'evt1', sub_event_id: 'se1', uploaded_by: 'u1', type: 'video', url: 'url', drive_sync_status: 'pending', created_at: new Date().toISOString() };
    const chain = buildChain(mockMedia);
    mockFrom.mockReturnValue(chain);
    const result = await createMediaRecord({ event_id: 'evt1', sub_event_id: 'se1', uploaded_by: 'u1', type: 'video', url: 'url' });
    expect(result.media?.sub_event_id).toBe('se1');
  });

  it('ripiega su INSERT semplice se manca il unique constraint per onConflict (drift DB)', async () => {
    // Simula il caso scoperto 27/07/2026: la migration 00037 con uniq_media_event_r2key
    // non è ancora stata applicata → Supabase rifiuta l'upsert con "ON CONFLICT specification"
    // → prima il record andrebbe perso in galleria. Ora il fallback fa un INSERT semplice.
    const conflictChain = buildChain(null, { message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification' });
    const insertedMedia = { id: 'm3', event_id: 'evt1', uploaded_by: 'u1', type: 'photo', url: 'r2key1', drive_sync_status: 'pending', created_at: new Date().toISOString(), r2_key: 'r2key1' };
    const insertChain = buildChain(insertedMedia);
    let callIdx = 0;
    mockFrom.mockImplementation(() => {
      callIdx++;
      return callIdx === 1 ? conflictChain : insertChain;
    });
    const result = await createMediaRecord({ event_id: 'evt1', uploaded_by: 'u1', type: 'photo', url: 'r2key1', r2_key: 'r2key1' });
    expect(result.error).toBeUndefined();
    expect(result.media?.id).toBe('m3');
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(conflictChain.upsert).toHaveBeenCalled();
    expect(insertChain.insert).toHaveBeenCalled();
  });

  it('FIX 29/07/2026: passa original_r2_key al DB per re-watermark puliti (migration 00040)', async () => {
    // Verifica che il campo original_r2_key venga correttamente persistito per
    // consentire a repairWatermarkForEvent di scaricare l'originale NON
    // watermarked invece di applicare il watermark sopra al watermarked.
    const mockMedia = {
      id: 'm4', event_id: 'evt1', uploaded_by: 'u1', type: 'photo', url: 'r2key1',
      drive_sync_status: 'pending', created_at: new Date().toISOString(),
      r2_key: 'events/2026_07_30_Agostino_Danila/photo1.jpg',
      original_r2_key: 'originals/events/2026_07_30_Agostino_Danila/photo1.jpg',
    };
    const chain = buildChain(mockMedia);
    mockFrom.mockReturnValue(chain);
    const result = await createMediaRecord({
      event_id: 'evt1', uploaded_by: 'u1', type: 'photo',
      url: 'r2key1', r2_key: 'r2key1',
      original_r2_key: 'originals/events/2026_07_30_Agostino_Danila/photo1.jpg',
    });
    expect(result.media?.original_r2_key).toBe('originals/events/2026_07_30_Agostino_Danila/photo1.jpg');
    // Verifica che l'original_r2_key sia stato passato nell'upsert
    const upsertCall = (chain.upsert as any).mock.calls[0][0];
    expect(upsertCall.original_r2_key).toBe('originals/events/2026_07_30_Agostino_Danila/photo1.jpg');
  });

  it('original_r2_key opzionale: NULL accettato per record pre-migration', async () => {
    const mockMedia = { id: 'm5', original_r2_key: null };
    const chain = buildChain(mockMedia);
    mockFrom.mockReturnValue(chain);
    const result = await createMediaRecord({
      event_id: 'evt1', uploaded_by: 'u1', type: 'photo',
      url: 'r2key1', r2_key: 'r2key1',
      original_r2_key: null,
    });
    expect(result.error).toBeUndefined();
    const upsertCall = (chain.upsert as any).mock.calls[0][0];
    expect(upsertCall.original_r2_key).toBeNull();
  });
});

describe('getMediaByEvent', () => {
  it('ritorna media per evento', async () => {
    const chain = buildChain([{ id: 'm1' }]);
    mockFrom.mockReturnValue(chain);
    const result = await getMediaByEvent('evt1');
    expect(result.media).toHaveLength(1);
  });

  it('ritorna array vuoto se nessun media', async () => {
    const chain = buildChain(null);
    mockFrom.mockReturnValue(chain);
    const result = await getMediaByEvent('evt1');
    expect(result.media).toEqual([]);
  });

  it('ritorna errore', async () => {
    const chain = buildChain(null, { message: 'Query error' });
    mockFrom.mockReturnValue(chain);
    const result = await getMediaByEvent('evt1');
    expect(result.error).toBe('Query error');
  });
});

describe('updateDriveSyncStatus', () => {
  it('aggiorna lo stato a synced con drive_file_id', async () => {
    const chain = buildChain(null);
    mockFrom.mockReturnValue(chain);
    const result = await updateDriveSyncStatus('m1', 'synced', 'drive123');
    expect(result.error).toBeUndefined();
  });

  it('ritorna errore se update fallisce', async () => {
    const chain = buildChain(null, { message: 'Update error' });
    mockFrom.mockReturnValue(chain);
    const result = await updateDriveSyncStatus('m1', 'failed');
    expect(result.error).toBe('Update error');
  });
});

describe('uploadToR2', () => {
  it('usa getPresignedUploadUrl e ritorna i valori', async () => {
    const { getPresignedUploadUrl } = await import('@fotosposi/r2-storage');
    (getPresignedUploadUrl as any).mockResolvedValue({ success: true, key: 'k1', url: 'u1', presignedUrl: 'pu1' });
    const result = await uploadToR2('prefix', 'foto.jpg', 'image/jpeg');
    expect(result.key).toBe('k1');
    expect(result.presignedUrl).toBe('pu1');
  });

  it('ritorna errore se fallisce', async () => {
    const { getPresignedUploadUrl } = await import('@fotosposi/r2-storage');
    (getPresignedUploadUrl as any).mockResolvedValue({ success: false, error: 'R2 error' });
    const result = await uploadToR2('prefix', 'f.jpg', 'image/jpeg');
    expect(result.error).toBe('R2 error');
  });
});

describe('deleteFromR2', () => {
  it('cancella e ritorna successo', async () => {
    const { deleteObject } = await import('@fotosposi/r2-storage');
    (deleteObject as any).mockResolvedValue(true);
    const result = await deleteFromR2('key1');
    expect(result.error).toBeUndefined();
  });

  it('ritorna errore se cancellazione fallisce', async () => {
    const { deleteObject } = await import('@fotosposi/r2-storage');
    (deleteObject as any).mockResolvedValue(false);
    const result = await deleteFromR2('key1');
    expect(result.error).toBe('Errore cancellazione R2');
  });
});

describe('createVideoMessage', () => {
  it('crea un video messaggio', async () => {
    const mockMsg = { id: 'vm1', event_id: 'evt1', from_user: 'u1', type: 'guestbook', url: 'url', created_at: new Date().toISOString() };
    const chain = buildChain(mockMsg);
    mockFrom.mockReturnValue(chain);
    const result = await createVideoMessage({ event_id: 'evt1', from_user: 'u1', type: 'guestbook', url: 'url' });
    expect(result.message?.id).toBe('vm1');
  });
});

describe('getVideoMessages', () => {
  it('ritorna messaggi senza filtro tipo', async () => {
    const chain = buildChain([{ id: 'vm1', type: 'guestbook' }]);
    mockFrom.mockReturnValue(chain);
    const result = await getVideoMessages('evt1');
    expect(result.messages).toHaveLength(1);
  });

  it('ritorna messaggi filtrati per tipo', async () => {
    const chain = buildChain([{ id: 'vm2', type: 'welcome' }]);
    mockFrom.mockReturnValue(chain);
    const result = await getVideoMessages('evt1', 'welcome');
    expect(result.messages).toHaveLength(1);
  });
});
