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

const { getConsent, setConsent, getConsentList, createFaceTag, getFaceTagsByMedia } = await import('../service');

describe('getConsent', () => {
  it('returns consent when user has consented', async () => {
    mockFrom.mockReturnValue(build({ id: 'c1', event_id: 'evt1', user_id: 'u1', consented: true, consented_at: '2026-01-01' }));
    const result = await getConsent('evt1', 'u1');
    expect(result.consent?.consented).toBe(true);
    expect(result.consent?.consented_at).toBeDefined();
  });

  it('returns undefined when no consent record exists', async () => {
    mockFrom.mockReturnValue(build(null));
    const result = await getConsent('evt1', 'u1');
    expect(result.consent).toBeUndefined();
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getConsent('evt1', 'u1');
    expect(result.error).toBe('DB error');
  });
});

describe('setConsent', () => {
  it('upserts consent with consented=true', async () => {
    mockFrom.mockReturnValue(build({}));
    const result = await setConsent('evt1', 'u1', true);
    expect(result.error).toBeUndefined();
  });

  it('upserts consent with consented=false', async () => {
    mockFrom.mockReturnValue(build({}));
    const result = await setConsent('evt1', 'u1', false);
    expect(result.error).toBeUndefined();
  });

  it('returns error on upsert failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await setConsent('evt1', 'u1', true);
    expect(result.error).toBe('DB error');
  });
});

describe('getConsentList', () => {
  it('returns all consents for an event', async () => {
    mockFrom.mockReturnValue(build([
      { id: 'c1', user_id: 'u1', consented: true },
      { id: 'c2', user_id: 'u2', consented: false },
    ]));
    const result = await getConsentList('evt1');
    expect(result.consents).toHaveLength(2);
    expect(result.consents![1].consented).toBe(false);
  });

  it('returns empty array when no consents', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getConsentList('evt1');
    expect(result.consents).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getConsentList('evt1');
    expect(result.error).toBe('DB error');
  });
});

describe('createFaceTag', () => {
  it('creates a face tag without face_box', async () => {
    mockFrom.mockReturnValue(build({}));
    const result = await createFaceTag('media1', 'u1');
    expect(result.error).toBeUndefined();
  });

  it('creates a face tag with face_box', async () => {
    mockFrom.mockReturnValue(build({}));
    const result = await createFaceTag('media1', 'u1', { x: 100, y: 50, w: 200, h: 300 });
    expect(result.error).toBeUndefined();
  });

  it('returns error on insert failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await createFaceTag('media1', 'u1');
    expect(result.error).toBe('DB error');
  });
});

describe('getFaceTagsByMedia', () => {
  it('returns tags for a media item', async () => {
    mockFrom.mockReturnValue(build([
      { id: 't1', media_id: 'media1', user_id: 'u1', face_box: { x: 10, y: 20 } },
    ]));
    const result = await getFaceTagsByMedia('media1');
    expect(result.tags).toHaveLength(1);
    expect(result.tags![0].user_id).toBe('u1');
  });

  it('returns empty array when no tags', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getFaceTagsByMedia('media1');
    expect(result.tags).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getFaceTagsByMedia('media1');
    expect(result.error).toBe('DB error');
  });
});
