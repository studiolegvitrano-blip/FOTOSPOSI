import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

function buildChain(data: any, error: any = null) {
  const chain: any = {
    data, error,
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(chain)),
    maybeSingle: vi.fn(() => Promise.resolve(chain)),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  };
  return chain;
}

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { saveDriveToken, getDriveToken, deleteDriveToken, getEventDriveFolders, refreshDriveAccessToken, ensureDriveFolders } = await import('../tokens');

describe('saveDriveToken', () => {
  it('salva un token Drive', async () => {
    const mockToken = { id: 't1', event_id: 'evt1', access_token: 'tok', expires_at: new Date().toISOString() };
    const chain = buildChain(mockToken);
    mockFrom.mockReturnValue(chain);
    const result = await saveDriveToken({ event_id: 'evt1', access_token: 'tok', refresh_token: 'rtok', expires_at: new Date().toISOString() });
    expect(result.token?.id).toBe('t1');
  });

  it('ritorna errore se upsert fallisce', async () => {
    const chain = buildChain(null, { message: 'DB error' });
    mockFrom.mockReturnValue(chain);
    const result = await saveDriveToken({ event_id: 'evt1', access_token: 'a', refresh_token: null, expires_at: new Date().toISOString() });
    expect(result.error).toBe('DB error');
  });
});

describe('getDriveToken', () => {
  it('ritorna il token', async () => {
    const mockToken = { id: 't1', event_id: 'evt1', access_token: 'tok' };
    const chain = buildChain(mockToken);
    mockFrom.mockReturnValue(chain);
    const result = await getDriveToken('evt1');
    expect(result.token?.access_token).toBe('tok');
  });

  it('ritorna undefined se nessun token', async () => {
    const chain = buildChain(null);
    mockFrom.mockReturnValue(chain);
    const result = await getDriveToken('evt1');
    expect(result.token).toBeUndefined();
  });
});

describe('deleteDriveToken', () => {
  it('cancella token', async () => {
    const chain = buildChain(null);
    mockFrom.mockReturnValue(chain);
    const result = await deleteDriveToken('evt1');
    expect(result.error).toBeUndefined();
  });
});

describe('getEventDriveFolders', () => {
  it('ritorna mappa folder', async () => {
    const rows = [{ folder_name: 'Foto', folder_id: 'f1' }, { folder_name: 'Video', folder_id: 'f2' }];
    const chain = buildChain(rows);
    mockFrom.mockReturnValue(chain);
    const result = await getEventDriveFolders('evt1');
    expect(result.folders?.Foto).toBe('f1');
    expect(result.folders?.Video).toBe('f2');
    expect(Object.keys(result.folders!)).toHaveLength(2);
  });

  it('ritorna mappa vuota se nessuna folder', async () => {
    const chain = buildChain([]);
    mockFrom.mockReturnValue(chain);
    const result = await getEventDriveFolders('evt1');
    expect(Object.keys(result.folders!)).toHaveLength(0);
  });

  it('ritorna errore', async () => {
    const chain = buildChain(null, { message: 'DB error' });
    mockFrom.mockReturnValue(chain);
    const result = await getEventDriveFolders('evt1');
    expect(result.error).toBe('DB error');
  });
});

describe('refreshDriveAccessToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('ritorna access token se refresh ok', async () => {
    (fetch as any).mockResolvedValue({ json: () => Promise.resolve({ access_token: 'new-token' }) });
    const result = await refreshDriveAccessToken('rtok');
    expect(result.access_token).toBe('new-token');
  });

  it('ritorna errore se refresh fallisce', async () => {
    (fetch as any).mockResolvedValue({ json: () => Promise.resolve({ error: 'invalid_grant', error_description: 'Token expired' }) });
    const result = await refreshDriveAccessToken('bad-rtok');
    expect(result.error).toBe('Token expired');
  });
});

describe('ensureDriveFolders', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('crea root folder se non esiste', async () => {
    let callCount = 0;
    (fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ json: () => Promise.resolve({ files: [] }) });
      if (callCount === 2) return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'root1' }) });
      return Promise.resolve({ json: () => Promise.resolve({ files: [{ id: 'f1', name: 'Foto' }] }) });
    });
    const result = await ensureDriveFolders('tok');
    expect(result.folders?.root).toBe('root1');
  });

  it('usa root folder esistente', async () => {
    (fetch as any).mockResolvedValue({ json: () => Promise.resolve({ files: [{ id: 'existing-root' }] }) });
    const result = await ensureDriveFolders('tok');
    expect(result.folders?.root).toBe('existing-root');
  });

  it('ritorna errore se creazione root fallisce', async () => {
    let callCount = 0;
    (fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ json: () => Promise.resolve({ files: [] }) });
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: { message: 'API error' } }) });
    });
    const result = await ensureDriveFolders('tok');
    expect(result.error).toBe('API error');
  });

  it('usa brand Sposi.live di default se non specificato', async () => {
    let urlLog: string[] = [];
    (fetch as any).mockImplementation((url: string) => {
      urlLog.push(typeof url === 'string' ? url : String(url));
      return Promise.resolve({ json: () => Promise.resolve({ files: [{ id: 'root-sposi', name: 'Sposi.live' }] }) });
    });
    await ensureDriveFolders('tok');
    expect(urlLog[0]).toContain(encodeURIComponent("Sposi.live"));
    expect(urlLog[0]).not.toContain(encodeURIComponent("JustMarry.live"));
  });

  it('usa brand JustMarry.live quando esplicitato', async () => {
    let urlLog: string[] = [];
    (fetch as any).mockImplementation((url: string) => {
      urlLog.push(typeof url === 'string' ? url : String(url));
      return Promise.resolve({ json: () => Promise.resolve({ files: [{ id: 'root-jm', name: 'JustMarry.live' }] }) });
    });
    const result = await ensureDriveFolders('tok', 'JustMarry.live');
    expect(urlLog[0]).toContain(encodeURIComponent("JustMarry.live"));
    expect(result.folders?.root).toBe('root-jm');
  });

  it('crea subfolder Foto e le mappa lowercase', async () => {
    let callCount = 0;
    (fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ json: () => Promise.resolve({ files: [{ id: 'root1' }] }) });
      if (callCount === 2) return Promise.resolve({ json: () => Promise.resolve({ files: [] }) });
      if (callCount === 3) return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'foto-id' }) });
      return Promise.resolve({ json: () => Promise.resolve({ files: [{ id: 'existing', name: 'Video' }] }) });
    });
    const result = await ensureDriveFolders('tok');
    expect(result.folders?.foto).toBe('foto-id');
    expect(result.folders?.video).toBe('existing');
  });

  it('lancia errore se subfolder creation fallisce (mappa solo quelle ce)', async () => {
    let callCount = 0;
    (fetch as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve({ json: () => Promise.resolve({ files: [{ id: 'root1' }] }) });
      if (callCount === 2) return Promise.resolve({ json: () => Promise.resolve({ files: [] }) });
      if (callCount === 3) return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: { message: 'fail' } }) });
      return Promise.resolve({ json: () => Promise.resolve({ files: [] }) });
    });
    const result = await ensureDriveFolders('tok');
    expect(result.folders?.foto).toBeUndefined();
    expect(result.folders?.root).toBe('root1');
  });
});
