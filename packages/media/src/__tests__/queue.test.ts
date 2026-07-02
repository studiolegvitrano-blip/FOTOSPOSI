import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

function buildChain(data: any, error: any = null) {
  const chain: any = {
    data, error,
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    in: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(chain)),
  };
  return chain;
}

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { enqueueUpload, getPendingQueue, updateQueueItem, getQueueStats, clearCompletedQueue } = await import('../queue');

describe('enqueueUpload', () => {
  it('inserisce un item in coda e ritorna id', async () => {
    const chain = buildChain({ id: 'q1' });
    mockFrom.mockReturnValue(chain);
    const result = await enqueueUpload({ event_id: 'evt1', uploaded_by: 'u1', file_name: 'foto.jpg', file_type: 'image/jpeg', file_size: 1000 });
    expect(result.id).toBe('q1');
  });

  it('ritorna errore se insert fallisce', async () => {
    const chain = buildChain(null, { message: 'Insert error' });
    mockFrom.mockReturnValue(chain);
    const result = await enqueueUpload({ event_id: 'evt1', uploaded_by: 'u1', file_name: 'f.jpg', file_type: 'image/jpeg', file_size: 500 });
    expect(result.error).toBe('Insert error');
  });
});

describe('getPendingQueue', () => {
  it('ritorna item pending/processing/failed ordinati', async () => {
    const chain = buildChain([{ id: 'q1', status: 'pending' }, { id: 'q2', status: 'failed' }]);
    mockFrom.mockReturnValue(chain);
    const result = await getPendingQueue('evt1');
    expect(result.items).toHaveLength(2);
  });

  it('ritorna array vuoto se nessun item', async () => {
    const chain = buildChain([]);
    mockFrom.mockReturnValue(chain);
    const result = await getPendingQueue('evt1');
    expect(result.items).toEqual([]);
  });

  it('ritorna errore', async () => {
    const chain = buildChain(null, { message: 'Query error' });
    mockFrom.mockReturnValue(chain);
    const result = await getPendingQueue('evt1');
    expect(result.error).toBe('Query error');
  });
});

describe('updateQueueItem', () => {
  it('aggiorna un item della coda', async () => {
    const chain = buildChain(null);
    mockFrom.mockReturnValue(chain);
    const result = await updateQueueItem('q1', { status: 'synced', processed_at: new Date().toISOString() });
    expect(result.error).toBeUndefined();
  });

  it('ritorna errore se update fallisce', async () => {
    const chain = buildChain(null, { message: 'Update error' });
    mockFrom.mockReturnValue(chain);
    const result = await updateQueueItem('q1', { status: 'failed' });
    expect(result.error).toBe('Update error');
  });
});

describe('getQueueStats', () => {
  it('conta correttamente gli stati', async () => {
    const items = [
      { status: 'pending' }, { status: 'processing' },
      { status: 'synced' }, { status: 'synced' }, { status: 'synced' },
      { status: 'failed' },
    ];
    const chain = buildChain(items);
    mockFrom.mockReturnValue(chain);
    const result = await getQueueStats('evt1');
    expect(result.pending).toBe(1);
    expect(result.processing).toBe(1);
    expect(result.synced).toBe(3);
    expect(result.failed).toBe(1);
  });

  it('ritorna zeri se data è vuoto', async () => {
    const chain = buildChain([]);
    mockFrom.mockReturnValue(chain);
    const result = await getQueueStats('evt1');
    expect(result.pending).toBe(0);
    expect(result.synced).toBe(0);
  });
});

describe('clearCompletedQueue', () => {
  it('cancella item synced e failed', async () => {
    const chain = buildChain(null);
    mockFrom.mockReturnValue(chain);
    const result = await clearCompletedQueue('evt1');
    expect(result.error).toBeUndefined();
  });

  it('ritorna errore se delete fallisce', async () => {
    const chain = buildChain(null, { message: 'Delete error' });
    mockFrom.mockReturnValue(chain);
    const result = await clearCompletedQueue('evt1');
    expect(result.error).toBe('Delete error');
  });
});
