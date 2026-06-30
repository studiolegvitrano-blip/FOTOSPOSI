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
  return p;
}

function build(val: any) {
  return {
    select: () => chain(val),
    insert: (obj?: any) => chain(obj ?? val),
    upsert: () => chain(null),
  };
}

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { getEventAnalytics, getB2BAnalytics } = await import('../service');

describe('getEventAnalytics', () => {
  it('aggregates media, orders, votes, jokes per event', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'media_uploads') return build([{ id: 'm1', type: 'photo' }, { id: 'm2', type: 'photo' }, { id: 'm3', type: 'video' }]);
      if (table === 'orders') return build([{ id: 'o1', amount: 5000 }, { id: 'o2', amount: 2500 }]);
      if (table === 'votes') return build([{ id: 'v1' }, { id: 'v2' }]);
      if (table === 'joke_entries') return build([{ id: 'j1' }]);
      if (table === 'events') return build({ tier: 'premium' });
      return build([]);
    });
    const result = await getEventAnalytics('evt1');
    expect(result.data?.total_uploads).toBe(3);
    expect(result.data?.total_photos).toBe(2);
    expect(result.data?.total_videos).toBe(1);
    expect(result.data?.total_orders).toBe(2);
    expect(result.data?.total_revenue).toBe(7500);
    expect(result.data?.total_votes).toBe(2);
    expect(result.data?.total_jokes).toBe(1);
    expect(result.data?.events_by_tier).toEqual({ premium: 1 });
  });

  it('returns zeros when queries return null', async () => {
    mockFrom.mockImplementation(() => build(null));
    const result = await getEventAnalytics('evt1');
    expect(result.data?.total_uploads).toBe(0);
    expect(result.data?.total_orders).toBe(0);
    expect(result.data?.total_revenue).toBe(0);
    expect(result.data?.events_by_tier).toEqual({});
  });
});

describe('getB2BAnalytics', () => {
  it('aggregates across all events of a tenant', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return build([{ id: 'evt1', tier: 'base' }, { id: 'evt2', tier: 'premium' }]);
      if (table === 'media_uploads') return build([{ id: 'm1', type: 'photo' }, { id: 'm2', type: 'video' }]);
      if (table === 'orders') return build([{ id: 'o1', amount: 1000 }]);
      return build([]);
    });
    const result = await getB2BAnalytics('tenant1');
    expect(result.data?.event_count).toBe(2);
    expect(result.data?.total_uploads).toBe(2);
    expect(result.data?.total_photos).toBe(1);
    expect(result.data?.total_videos).toBe(1);
    expect(result.data?.total_orders).toBe(1);
    expect(result.data?.total_revenue).toBe(1000);
    expect(result.data?.events_by_tier).toEqual({ base: 1, premium: 1 });
  });

  it('returns zeros when tenant has no events', async () => {
    mockFrom.mockImplementation(() => build([]));
    const result = await getB2BAnalytics('empty-tenant');
    expect(result.data?.event_count).toBe(0);
    expect(result.data?.total_uploads).toBe(0);
    expect(result.data?.total_revenue).toBe(0);
    expect(result.data?.events_by_tier).toEqual({});
  });
});
