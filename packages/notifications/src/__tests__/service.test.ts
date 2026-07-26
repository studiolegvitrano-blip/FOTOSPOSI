import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetWhatsAppProviderForTests } from '../providers/whatsapp';

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
    delete process.env.WHATSAPP_PROVIDER;
    delete process.env.WA_AUTOMATE_URL;
    delete process.env.WA_AUTOMATE_API_KEY;
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
  it('logs failed when whatsapp channel has no provider configured', async () => {
    // No WHATSAPP_* envs set → selector throws ProviderNotConfiguredError → service sets failed.
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_log') {
        return { select: () => chain([]), insert: (obj: any) => chain(obj), upsert: () => chain(null) };
      }
      return build([]);
    });
    const result = await sendNotification({
      event_id: 'evt1',
      channel: 'whatsapp',
      recipient: '+393334445566',
      body: 'Ciao!',
    });
    expect(result.log?.status).toBe('failed');
    expect(result.log?.error).toMatch(/WhatsApp provider non configurato/i);
  });

  it('sends whatsapp via wa-automate provider when configured', async () => {
    process.env.WHATSAPP_PROVIDER = 'wa-automate';
    process.env.WA_AUTOMATE_URL = 'http://localhost:8080';
    process.env.WA_AUTOMATE_API_KEY = 'wa-key';
    resetWhatsAppProviderForTests();
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ success: true, id: 'wa_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_log') {
        return { select: () => chain([]), insert: (obj: any) => chain(obj), upsert: () => chain(null) };
      }
      return build([]);
    });
    const result = await sendNotification({
      event_id: 'evt1',
      channel: 'whatsapp',
      recipient: '+39 333 444 5566',
      body: 'Ciao da Sposi!',
    });
    expect(result.log?.status).toBe('sent');
    expect(result.log?.sent_at).toBeDefined();
    // Confirm we posted to wa-automate endpoint
    const [url, init] = (global.fetch as any).mock.calls.at(-1);
    expect(String(url)).toBe('http://localhost:8080/sendText');
    const body = JSON.parse((init as any).body as string);
    expect(body.phone).toBe('393334445566');
    expect(body.message).toBe('Ciao da Sposi!');
    delete process.env.WHATSAPP_PROVIDER;
    delete process.env.WA_AUTOMATE_URL;
    delete process.env.WA_AUTOMATE_API_KEY;
    resetWhatsAppProviderForTests();
  });

  it('sends whatsapp via evolution provider (legacy) when configured', async () => {
    process.env.WHATSAPP_PROVIDER = 'evolution';
    process.env.EVOLUTION_API_URL = 'http://evo:3000';
    process.env.EVOLUTION_API_KEY = 'evo-key';
    resetWhatsAppProviderForTests();
    (global.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ id: 'evo_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notification_log') {
        return { select: () => chain([]), insert: (obj: any) => chain(obj), upsert: () => chain(null) };
      }
      return build([]);
    });
    const result = await sendNotification({
      event_id: 'evt1',
      channel: 'whatsapp',
      recipient: '+39 02 1234',
      body: 'Legacy evolution',
    });
    expect(result.log?.status).toBe('sent');
    const [url, init] = (global.fetch as any).mock.calls.at(-1);
    expect(String(url)).toBe('http://evo:3000/message/send');
    const headers = (init as any).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer evo-key');
    const body = JSON.parse((init as any).body as string);
    expect(body.number).toBe('39021234');
    delete process.env.WHATSAPP_PROVIDER;
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    resetWhatsAppProviderForTests();
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
