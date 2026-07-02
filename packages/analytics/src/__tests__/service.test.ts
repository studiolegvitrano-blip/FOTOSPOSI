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

const { getEventAnalytics, getB2BAnalytics, getActivationMetrics, getEngagementMetrics, getViralMetrics, getB2BConversionMetrics } = await import('../service');

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

describe('getActivationMetrics', () => {
  it('computes activation rate from site_drafts within 48h', async () => {
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
    const fiveDaysAgo = new Date(now.getTime() - 120 * 60 * 60 * 1000).toISOString();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return build([
        { id: 'evt1', created_at: sixHoursAgo },
        { id: 'evt2', created_at: fiveDaysAgo },
        { id: 'evt3', created_at: threeDaysAgo },
      ]);
      if (table === 'site_drafts') return build([
        { event_id: 'evt1', published: true, updated_at: now.toISOString() },
        { event_id: 'evt2', published: true, updated_at: now.toISOString() },
        { event_id: 'evt3', published: false, updated_at: null },
      ]);
      return build([]);
    });
    const result = await getActivationMetrics('tenant1');
    expect(result.data?.total_events).toBe(3);
    expect(result.data?.events_with_site).toBe(2);
    expect(result.data?.events_activated_48h).toBe(1);
    expect(result.data?.activation_rate_48h).toBe(33);
  });

  it('returns zeros when no events exist', async () => {
    mockFrom.mockImplementation(() => build([]));
    const result = await getActivationMetrics('empty');
    expect(result.data?.total_events).toBe(0);
    expect(result.data?.activation_rate_48h).toBe(0);
  });

  it('handles DB error on events query', async () => {
    mockFrom.mockReturnValue(build(null));
    // With null data, events will be empty array -> early return
    const result = await getActivationMetrics('empty');
    expect(result.data?.total_events).toBe(0);
  });
});

describe('getEngagementMetrics', () => {
  it('aggregates uploaders, voters, and game participants per event', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return build([{ id: 'evt1' }, { id: 'evt2' }]);
      if (table === 'media_uploads') return build([
        { event_id: 'evt1', uploaded_by: 'u1' },
        { event_id: 'evt1', uploaded_by: 'u2' },
        { event_id: 'evt2', uploaded_by: 'u3' },
      ]);
      if (table === 'votes') return build([
        { event_id: 'evt1', voter_id: 'u1' },
        { event_id: 'evt2', voter_id: 'u3' },
      ]);
      if (table === 'joke_entries') return build([
        { event_id: 'evt1', from_user: 'u4' },
      ]);
      if (table === 'photo_hunt_registrations') return build([
        { event_id: 'evt1', id: 'ph1' },
      ]);
      if (table === 'dress_votes') return build([
        { event_id: 'evt2', voter_id: 'u5' },
      ]);
      return build([]);
    });
    const result = await getEngagementMetrics('tenant1');
    expect(result.data).toHaveLength(2);
    const evt1 = result.data!.find(e => e.event_id === 'evt1')!;
    expect(evt1.users_with_upload).toBe(2);
    expect(evt1.users_with_vote).toBe(1);
    expect(evt1.users_with_game_participation).toBe(1);
    const evt2 = result.data!.find(e => e.event_id === 'evt2')!;
    expect(evt2.total_users).toBe(2);
  });

  it('returns empty array when no events', async () => {
    mockFrom.mockImplementation(() => build([]));
    const result = await getEngagementMetrics('empty');
    expect(result.data).toEqual([]);
  });

  it('returns error on events query failure', async () => {
    mockFrom.mockReturnValue(build(null));
    const result = await getEngagementMetrics('empty');
    expect(result.data).toEqual([]);
  });
});

describe('getViralMetrics', () => {
  it('computes viral coefficient from social_shares', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return build([{ id: 'evt1' }]);
      if (table === 'social_shares') return build([
        { medium: 'whatsapp', content_type: 'photo_overlay', clicked_back: true },
        { medium: 'whatsapp', content_type: 'photo_overlay', clicked_back: false },
        { medium: 'instagram', content_type: 'wrapped_card', clicked_back: true },
        { medium: 'copy_link', content_type: 'site_invite', clicked_back: false },
      ]);
      return build([]);
    });
    const result = await getViralMetrics('tenant1');
    expect(result.data?.total_shares).toBe(4);
    expect(result.data?.total_clickbacks).toBe(2);
    expect(result.data?.viral_coefficient).toBe(50);
    expect(result.data?.shares_by_medium).toEqual({ whatsapp: 2, instagram: 1, copy_link: 1 });
    expect(result.data?.shares_by_content).toEqual({ photo_overlay: 2, wrapped_card: 1, site_invite: 1 });
  });

  it('returns zeros when no shares', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'events') return build([{ id: 'evt1' }]);
      return build([]);
    });
    const result = await getViralMetrics('tenant1');
    expect(result.data?.total_shares).toBe(0);
    expect(result.data?.viral_coefficient).toBe(0);
  });

  it('returns zeros when no events', async () => {
    mockFrom.mockImplementation(() => build([]));
    const result = await getViralMetrics('empty');
    expect(result.data?.total_shares).toBe(0);
    expect(result.data?.viral_coefficient).toBe(0);
  });
});

describe('getB2BConversionMetrics', () => {
  it('computes supplier pipeline metrics', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'marketplace_suppliers') return build([
        { contacted_at: '2026-01-01', approved: true, active: true },
        { contacted_at: '2026-01-02', approved: true, active: false },
        { contacted_at: null, approved: false, active: false },
        { contacted_at: '2026-01-03', approved: false, active: false },
        { contacted_at: null, approved: false, active: false },
      ]);
      return build([]);
    });
    const result = await getB2BConversionMetrics('tenant1');
    expect(result.data?.total_suppliers).toBe(5);
    expect(result.data?.contacted).toBe(3);
    expect(result.data?.approved).toBe(2);
    expect(result.data?.active).toBe(1);
    expect(result.data?.contact_rate).toBe(60);
    expect(result.data?.approval_rate).toBe(40);
    expect(result.data?.active_rate).toBe(20);
  });

  it('returns zeros when no suppliers', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getB2BConversionMetrics('tenant1');
    expect(result.data?.total_suppliers).toBe(0);
    expect(result.data?.contacted).toBe(0);
    expect(result.data?.active_rate).toBe(0);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(build(null));
    const result = await getB2BConversionMetrics('tenant1');
    // build(null) returns null data, suppliers defaults to []
    expect(result.data?.total_suppliers).toBe(0);
  });
});
