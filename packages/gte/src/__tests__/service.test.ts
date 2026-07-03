import { describe, it, expect, vi } from 'vitest';

const resolvedPromise = Symbol('resolved');

function makeQuery(resolved: any) {
  const q: any = {};
  const terminal = vi.fn().mockResolvedValue(resolved);
  const chain = vi.fn(() => q);
  q.select = chain;
  q.eq = chain;
  q.gt = chain;
  q.order = chain;
  q.limit = terminal;
  q.single = terminal;
  q.insert = chain;
  q.update = chain;
  return q;
}

const mockFrom = vi.fn();
vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

const { getBrandConfig, recordEngagement, getB2BLeads, updateLeadStatus, getUGCForPipeline, recordPerformance } = await import('../service');

describe('GTE Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBrandConfig', () => {
    it('returns config on success', async () => {
      const fake = { id: '1', slug: 'weddingmoments', name: 'WeddingMoments' };
      mockFrom.mockReturnValue(makeQuery({ data: fake, error: null }));
      const { config, error } = await getBrandConfig('weddingmoments');
      expect(config).toEqual(fake);
      expect(error).toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith('brand_config');
    });

    it('returns error on failure', async () => {
      mockFrom.mockReturnValue(makeQuery({ data: null, error: { message: 'not found' } }));
      const { config, error } = await getBrandConfig('nope');
      expect(config).toBeUndefined();
      expect(error).toBe('not found');
    });
  });

  describe('recordEngagement', () => {
    it('inserts and returns record', async () => {
      const fake = { id: '1', platform: 'instagram', message_text: 'Bellissimo!' };
      mockFrom.mockReturnValue(makeQuery({ data: fake, error: null }));
      const { record, error } = await recordEngagement({ brand_id: 'b1', platform: 'instagram', message_text: 'Bellissimo!' });
      expect(record).toEqual(fake);
      expect(error).toBeUndefined();
    });
  });

  describe('getB2BLeads', () => {
    it('returns leads ordered by created_at desc', async () => {
      const fake = [{ id: '1', source_platform: 'instagram', contact_status: 'new' }];
      mockFrom.mockReturnValue(makeQuery({ data: fake, error: null }));
      const { leads } = await getB2BLeads({ limit: 10 });
      expect(leads).toEqual(fake);
    });
  });

  describe('updateLeadStatus', () => {
    it('updates and returns lead', async () => {
      const fake = { id: '1', contact_status: 'contacted' };
      mockFrom.mockReturnValue(makeQuery({ data: fake, error: null }));
      const { lead } = await updateLeadStatus('1', 'contacted');
      expect(lead?.contact_status).toBe('contacted');
    });
  });

  describe('getUGCForPipeline', () => {
    it('returns UGC with event join', async () => {
      const fake = [{ id: 'u1', file_type: 'photo', events: { couple_name: 'Test' } }];
      mockFrom.mockReturnValue(makeQuery({ data: fake, error: null }));
      const { ugc } = await getUGCForPipeline();
      expect(ugc).toEqual(fake);
    });
  });

  describe('recordPerformance', () => {
    it('inserts performance record', async () => {
      const fake = { id: 'p1', platform: 'instagram', impressions: 100 };
      mockFrom.mockReturnValue(makeQuery({ data: fake, error: null }));
      const { record } = await recordPerformance({ brand_id: 'b1', platform: 'instagram', impressions: 100 });
      expect(record?.impressions).toBe(100);
    });
  });
});
