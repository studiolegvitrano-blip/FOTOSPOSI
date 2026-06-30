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

const { getMessages, sendMessage, getAiResponse } = await import('../service');

describe('getMessages', () => {
  it('returns messages ordered by created_at', async () => {
    mockFrom.mockReturnValue(build([
      { id: 'm1', event_id: 'evt1', user_id: 'u1', role: 'user', content: 'Ciao' },
      { id: 'm2', event_id: 'evt1', user_id: 'u1', role: 'assistant', content: 'Salve!' },
    ]));
    const result = await getMessages('evt1', 'u1');
    expect(result.messages).toHaveLength(2);
    expect(result.messages![0].content).toBe('Ciao');
  });

  it('returns empty array when no messages', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getMessages('evt1', 'u1');
    expect(result.messages).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getMessages('evt1', 'u1');
    expect(result.error).toBe('DB error');
  });
});

describe('sendMessage', () => {
  it('inserts message and returns it', async () => {
    const msg = { id: 'm1', event_id: 'evt1', user_id: 'u1', role: 'user' as const, content: 'Ciao' };
    mockFrom.mockReturnValue(build(msg));
    const result = await sendMessage({ event_id: 'evt1', user_id: 'u1', role: 'user', content: 'Ciao' });
    expect(result.message?.content).toBe('Ciao');
  });

  it('returns error on insert failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await sendMessage({ event_id: 'evt1', user_id: 'u1', role: 'user', content: 'Test' });
    expect(result.error).toBe('DB error');
  });
});

describe('getAiResponse', () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    global.fetch = vi.fn();
  });

  it('returns fallback when ANTHROPIC_API_KEY is missing', async () => {
    const result = await getAiResponse([{ role: 'user', content: 'Ciao' }]);
    expect(result.content).toContain('non disponibile');
  });

  it('returns AI response on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ text: 'Ecco i migliori fornitori a Firenze.' }] }),
    });
    const result = await getAiResponse([{ role: 'user', content: 'Fornitori a Firenze?' }]);
    expect(result.content).toBe('Ecco i migliori fornitori a Firenze.');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns error when Claude API fails', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    (global.fetch as any).mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } }),
    });
    const result = await getAiResponse([{ role: 'user', content: 'Ciao' }]);
    expect(result.error).toBe('Rate limit exceeded');
  });

  it('handles network error', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
    const result = await getAiResponse([{ role: 'user', content: 'Ciao' }]);
    expect(result.error).toBe('Network error');
  });
});
