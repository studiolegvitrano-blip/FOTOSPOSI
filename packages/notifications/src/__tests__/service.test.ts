import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

function chain(val: any): any {
  const p = Promise.resolve({ data: val, error: null });
  (p as any).eq = vi.fn(() => chain(val));
  (p as any).in = vi.fn(() => chain(val));
  (p as any).single = vi.fn().mockResolvedValue({ data: val, error: null });
  (p as any).maybeSingle = vi.fn().mockResolvedValue({ data: val, error: null });
  (p as any).order = vi.fn(() => chain(val));
  (p as any).limit = vi.fn().mockResolvedValue({ data: val, error: null });
  (p as any).select = vi.fn(() => chain(val));
  return p;
}

function failChain(err: string): any {
  const p = Promise.resolve({ data: null, error: { message: err } });
  (p as any).eq = vi.fn(() => failChain(err));
  (p as any).in = vi.fn(() => failChain(err));
  (p as any).single = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
  (p as any).maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
  (p as any).order = vi.fn(() => failChain(err));
  (p as any).limit = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
  (p as any).select = vi.fn(() => failChain(err));
  return p;
}

function build(val: any) {
  return {
    select: () => chain(val),
    insert: (obj?: any) => chain(obj ?? val),
    upsert: () => chain(null),
  };
}

function buildFail(err: string) {
  return {
    select: () => failChain(err),
    insert: () => failChain(err),
    upsert: () => failChain(err),
  };
}

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { getPreferences, updatePreference, sendNotification, getNotificationLog } = await import('../service');

describe('getPreferences', () => {
  it('returns preferences for an event', async () => {
    mockFrom.mockReturnValue(build([{ id: 'p1', event_id: 'evt1', channel: 'email', enabled: true }]));
    const result = await getPreferences('evt1');
    expect(result.prefs).toHaveLength(1);
    expect(result.prefs![0].channel).toBe('email');
  });

  it('returns empty array when no preferences exist', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getPreferences('evt1');
    expect(result.prefs).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getPreferences('evt1');
    expect(result.error).toBe('DB error');
  });
});

describe('updatePreference', () => {
  it('upserts a preference successfully', async () => {
    mockFrom.mockReturnValue(build({}));
    const result = await updatePreference('evt1', 'email', true);
    expect(result.error).toBeUndefined();
  });

  it('returns error on upsert failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await updatePreference('evt1', 'whatsapp', false);
    expect(result.error).toBe('DB error');
  });
});

describe('sendNotification', () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_API_KEY;
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    global.fetch = vi.fn();
  });

  it('returns failed status when channel API key is missing', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_log') {
        return {
          select: () => chain([]),
          insert: (obj: any) => chain(obj),
          upsert: () => chain(null),
        };
      }
      return build([]);
    });
    const result = await sendNotification({
      event_id: 'evt1',
      channel: 'email',
      recipient: 'test@test.com',
      subject: 'Test',
      body: 'Hello',
    });
    expect(result.log?.status).toBe('failed');
    expect(result.log?.error).toContain('API_KEY');
  });

  it('sends email and logs sent status', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    (global.fetch as any).mockResolvedValue({ ok: true });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_log') {
        return {
          select: () => chain([]),
          insert: (obj: any) => chain(obj),
          upsert: () => chain(null),
        };
      }
      return build([]);
    });
    const result = await sendNotification({
      event_id: 'evt1',
      channel: 'email',
      recipient: 'a@b.com',
      subject: 'Welcome',
      body: 'Body text',
    });
    expect(result.log?.status).toBe('sent');
    expect(result.log?.sent_at).toBeDefined();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handles email API failure', async () => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    (global.fetch as any).mockResolvedValue({ ok: false, statusText: 'Unauthorized' });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_log') {
        return {
          select: () => chain([]),
          insert: (obj: any) => chain(obj),
          upsert: () => chain(null),
        };
      }
      return build([]);
    });
    const result = await sendNotification({
      event_id: 'evt1',
      channel: 'email',
      recipient: 'a@b.com',
      subject: 'Fail',
      body: 'Fail body',
    });
    expect(result.log?.status).toBe('failed');
    expect(result.log?.error).toContain('Unauthorized');
  });
});

describe('getNotificationLog', () => {
  it('returns recent log entries', async () => {
    mockFrom.mockReturnValue(build([{ id: 'l1', event_id: 'evt1', channel: 'email', status: 'sent' }]));
    const result = await getNotificationLog('evt1');
    expect(result.logs).toHaveLength(1);
    expect(result.logs![0].status).toBe('sent');
  });

  it('returns empty array when no logs exist', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getNotificationLog('evt1');
    expect(result.logs).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getNotificationLog('evt1');
    expect(result.error).toBe('DB error');
  });
});
