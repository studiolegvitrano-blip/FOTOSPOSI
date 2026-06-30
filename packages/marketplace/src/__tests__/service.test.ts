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

function failChain(err: string): any {
  const p = Promise.resolve({ data: null, error: { message: err } });
  (p as any).eq = vi.fn(() => failChain(err));
  (p as any).in = vi.fn(() => failChain(err));
  (p as any).single = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
  (p as any).maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
  (p as any).order = vi.fn(() => failChain(err));
  (p as any).limit = vi.fn().mockResolvedValue({ data: null, error: { message: err } });
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

const { getSuppliers, getSupplierById, createReview, getReviews, getAvgRating } = await import('../service');

describe('getSuppliers', () => {
  it('returns approved suppliers', async () => {
    mockFrom.mockReturnValue(build([{ id: 's1', name: 'FotoStudio', category: 'fotografia', approved: true }]));
    const result = await getSuppliers();
    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers![0].name).toBe('FotoStudio');
  });

  it('filters by category when provided', async () => {
    mockFrom.mockReturnValue(build([{ id: 's1', name: 'DJ Marco', category: 'musica', approved: true }]));
    const result = await getSuppliers('musica');
    expect(result.suppliers).toHaveLength(1);
    expect(result.suppliers![0].category).toBe('musica');
  });

  it('returns empty array when no suppliers', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getSuppliers();
    expect(result.suppliers).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getSuppliers();
    expect(result.error).toBe('DB error');
  });
});

describe('getSupplierById', () => {
  it('returns a single supplier', async () => {
    mockFrom.mockReturnValue(build({ id: 's1', name: 'PhotoPro', approved: true }));
    const result = await getSupplierById('s1');
    expect(result.supplier?.name).toBe('PhotoPro');
  });

  it('returns error when supplier not found', async () => {
    mockFrom.mockReturnValue(buildFail('Not found'));
    const result = await getSupplierById('invalid');
    expect(result.error).toBe('Not found');
  });
});

describe('createReview', () => {
  it('creates a review successfully', async () => {
    mockFrom.mockReturnValue(build({}));
    const result = await createReview({ supplier_id: 's1', event_id: 'evt1', rating: 5, comment: 'Great!' });
    expect(result.error).toBeUndefined();
  });

  it('returns error on insert failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await createReview({ supplier_id: 's1', event_id: 'evt1', rating: 3 });
    expect(result.error).toBe('DB error');
  });
});

describe('getReviews', () => {
  it('returns reviews for a supplier', async () => {
    mockFrom.mockReturnValue(build([{ id: 'r1', supplier_id: 's1', rating: 5, comment: 'Ottimo!' }]));
    const result = await getReviews('s1');
    expect(result.reviews).toHaveLength(1);
    expect(result.reviews![0].rating).toBe(5);
  });

  it('returns empty when no reviews', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getReviews('s1');
    expect(result.reviews).toEqual([]);
  });

  it('returns error on DB failure', async () => {
    mockFrom.mockReturnValue(buildFail('DB error'));
    const result = await getReviews('s1');
    expect(result.error).toBe('DB error');
  });
});

describe('getAvgRating', () => {
  it('computes average rating', async () => {
    mockFrom.mockReturnValue(build([{ rating: 5 }, { rating: 4 }, { rating: 3 }]));
    const result = await getAvgRating('s1');
    expect(result.avg).toBe(4);
    expect(result.count).toBe(3);
  });

  it('returns zero when no ratings', async () => {
    mockFrom.mockReturnValue(build([]));
    const result = await getAvgRating('s1');
    expect(result.avg).toBe(0);
    expect(result.count).toBe(0);
  });
});
