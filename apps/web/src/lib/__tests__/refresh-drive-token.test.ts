import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock delle dipendenze di @fotosposi/media. Il modulo `refreshDriveAccessToken`
// è importato dinamicamente dentro refreshDriveTokenIfExpired, quindi va mockato
// su quel namespace.
const mockRefreshDriveAccessToken = vi.fn();
vi.mock('@fotosposi/media', () => ({
  createMediaRecord: vi.fn(),
  getDriveToken: vi.fn(),
  getEventDriveFolders: vi.fn(),
  updateDriveSyncStatus: vi.fn(),
  refreshDriveAccessToken: (...args: unknown[]) => mockRefreshDriveAccessToken(...args),
}));

// createServiceClient ritorna un fake client con from() catenabile.
const mockFromUpdate = vi.fn();
const mockFrom = vi.fn(() => ({
  update: mockFromUpdate,
}));
mockFromUpdate.mockReturnValue({ eq: vi.fn(() => Promise.resolve({ error: null })) });

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

const { refreshDriveTokenIfExpired } = await import('../process-queue');

const validExpiresInFuture = new Date(Date.now() + 60_000).toISOString();
const expiredIso = new Date(Date.now() - 60_000).toISOString();

const baseToken = {
  id: 't1',
  event_id: 'evt1',
  access_token: 'old-token',
  refresh_token: 'rtok',
  token_type: 'Bearer',
  drive_email: null,
  expires_at: expiredIso,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fakeSupabase = { from: mockFrom } as unknown as Parameters<typeof refreshDriveTokenIfExpired>[2];

beforeEach(() => {
  vi.clearAllMocks();
  // Default chain: update(...).eq(...) risolve senza errore.
  mockFromUpdate.mockReturnValue({ eq: vi.fn(() => Promise.resolve({ error: null })) });
});

describe('refreshDriveTokenIfExpired', () => {
  it('ritorna undefined se current è undefined', async () => {
    const out = await refreshDriveTokenIfExpired('evt1', undefined, fakeSupabase);
    expect(out).toBeUndefined();
    expect(mockRefreshDriveAccessToken).not.toHaveBeenCalled();
  });

  it('non refresha se token NON scaduto (expires_at nel futuro)', async () => {
    const live = { ...baseToken, expires_at: validExpiresInFuture };
    const out = await refreshDriveTokenIfExpired('evt1', live, fakeSupabase);
    expect(out).toBe(live);
    expect(out?.access_token).toBe('old-token');
    expect(mockRefreshDriveAccessToken).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('non refresha se expires_at manca', async () => {
    const noExp = { ...baseToken, expires_at: undefined } as unknown as typeof baseToken;
    const out = await refreshDriveTokenIfExpired('evt1', noExp, fakeSupabase);
    expect(out?.access_token).toBe('old-token');
    expect(mockRefreshDriveAccessToken).not.toHaveBeenCalled();
  });

  it('non refresha se refresh_token è null', async () => {
    const noRefresh = { ...baseToken, refresh_token: null };
    const out = await refreshDriveTokenIfExpired('evt1', noRefresh, fakeSupabase);
    expect(out?.access_token).toBe('old-token');
    expect(mockRefreshDriveAccessToken).not.toHaveBeenCalled();
  });

  it('non refresha se refreshDriveAccessToken ritorna errore', async () => {
    mockRefreshDriveAccessToken.mockResolvedValue({ error: 'invalid_grant' });
    const out = await refreshDriveTokenIfExpired('evt1', baseToken, fakeSupabase);
    expect(out?.access_token).toBe('old-token');
    expect(mockRefreshDriveAccessToken).toHaveBeenCalledWith('rtok');
  });

  it('refresha e persiste se scaduto con refresh_token valido', async () => {
    mockRefreshDriveAccessToken.mockResolvedValue({ access_token: 'fresh-token' });
    const eqSpy = vi.fn(() => Promise.resolve({ error: null }));
    mockFromUpdate.mockReturnValue({ eq: eqSpy });

    const out = await refreshDriveTokenIfExpired('evt1', baseToken, fakeSupabase);

    expect(mockRefreshDriveAccessToken).toHaveBeenCalledWith('rtok');
    expect(mockFrom).toHaveBeenCalledWith('event_drive_tokens');
    expect(mockFromUpdate).toHaveBeenCalledWith(expect.objectContaining({
      access_token: 'fresh-token',
      updated_at: expect.any(String),
    }));
    expect(eqSpy).toHaveBeenCalledWith('event_id', 'evt1');
    expect(out?.access_token).toBe('fresh-token');
    // expires_at ora nel futuro (1h da adesso)
    expect(out?.expires_at && new Date(out.expires_at).getTime()).toBeGreaterThan(Date.now());
    // Gli altri campi preservati
    expect(out?.id).toBe('t1');
    expect(out?.event_id).toBe('evt1');
    expect(out?.refresh_token).toBe('rtok');
  });

  it('non propaga eccezioni di supabase (update fallito) — ritorna comunque token refreshed in memoria', async () => {
    mockRefreshDriveAccessToken.mockResolvedValue({ access_token: 'fresh-token' });
    const eqSpy = vi.fn(() => Promise.resolve({ error: { message: 'db down' } }));
    mockFromUpdate.mockReturnValue({ eq: eqSpy });

    const out = await refreshDriveTokenIfExpired('evt1', baseToken, fakeSupabase);

    expect(out?.access_token).toBe('fresh-token');
    expect(eqSpy).toHaveBeenCalledWith('event_id', 'evt1');
  });
});
