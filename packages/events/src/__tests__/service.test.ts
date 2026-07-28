import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

function buildChain(val: any, maybeVal: any = null) {
  const resolve = (v: any) => Promise.resolve({ data: v, error: null });
  const mkSingle = (v: any) => vi.fn().mockResolvedValue({ data: v, error: null });

  function makeHandler() {
    return {
      select: () => makeHandler(),
      eq: () => makeHandler(),
      order: () => makeHandler(),
      limit: () => makeHandler(),
      maybeSingle: mkSingle(maybeVal),
      single: mkSingle(val),
      rpc: () => makeHandler(),
      insert: () => ({
        select: () => makeHandler(),
        single: mkSingle(val),
      }),
      delete: () => makeHandler(),
      update: () => makeHandler(),
      then: (onfulfilled?: any) => resolve(val).then(onfulfilled),
    };
  }
  return makeHandler();
}

function buildFailChain(errorMsg: string) {
  return {
    select: () => ({
      eq: () => ({
        order: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: errorMsg } }),
        }),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: errorMsg } }),
      }),
      order: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: errorMsg } }),
        }),
      }),
    }),
    insert: () => ({
      select: () => ({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: errorMsg } }),
      }),
    }),
  };
}

vi.mock('@fotosposi/core', () => ({
  createServiceClient: () => ({ from: mockFrom }),
  createClient: () => ({ from: mockFrom }),
  calculateWindow: (date: string) => {
    const event = new Date(date);
    const opens = new Date(event);
    opens.setDate(opens.getDate() - 9);
    const closes = new Date(event);
    closes.setDate(closes.getDate() + 1);
    return { opens_at: opens.toISOString(), closes_at: closes.toISOString() };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { createEvent, getEventById, getEventsByUser, createSubEvent, getSubEvents, getEventWindow } = await import('../service');

describe('createEvent', () => {
  const params = {
    tenant_id: 't1',
    created_by: 'u1',
    couple_name: 'Mario & Lucia',
    date: '2026-09-15T10:00:00.000Z',
    location: 'Firenze',
    brand: 'fotosposi' as const,
  };

  it('crea evento e finestra 10gg', async () => {
    const evt = { id: 'evt1', ...params, tier: 'base', created_at: new Date().toISOString() };
    mockFrom.mockReturnValue(buildChain(evt));
    const result = await createEvent(params);
    expect(result.event).toBeDefined();
    expect(result.event!.couple_name).toBe('Mario & Lucia');
    expect(result.event!.tier).toBe('base');
  });

  it('ritorna errore se insert fallisce', async () => {
    mockFrom.mockReturnValue(buildFailChain('DB error'));
    const result = await createEvent(params);
    expect(result.error).toBe('DB error');
  });
});

describe('getEventById', () => {
  it('ritorna evento per id', async () => {
    mockFrom.mockReturnValue(buildChain({ id: 'evt1', couple_name: 'Mario & Lucia' }));
    const result = await getEventById('evt1');
    expect(result.event?.couple_name).toBe('Mario & Lucia');
  });
});

describe('getEventsByUser', () => {
  it('ritorna lista eventi per user', async () => {
    mockFrom.mockReturnValue(buildChain([{ id: 'evt1', couple_name: 'A' }, { id: 'evt2', couple_name: 'B' }]));
    const result = await getEventsByUser('u1');
    expect(result.events).toHaveLength(2);
  });
});

describe('createSubEvent', () => {
  it('crea un sub-evento', async () => {
    const se = { id: 'se1', event_id: 'evt1', type: 'matrimonio', title: 'Cerimonia', date: '2026-09-15', location: 'Duomo' };
    mockFrom.mockReturnValue(buildChain(se));
    const result = await createSubEvent({ event_id: 'evt1', type: 'matrimonio', title: 'Cerimonia', date: '2026-09-15' });
    expect(result.subEvent?.title).toBe('Cerimonia');
  });
});

describe('getSubEvents', () => {
  it('ritorna sub-eventi ordinati per data', async () => {
    mockFrom.mockReturnValue(buildChain([{ id: 'se1', title: 'A' }]));
    const result = await getSubEvents('evt1');
    expect(result.subEvents).toHaveLength(1);
  });
});

describe('getEventWindow', () => {
  it('ritorna finestra evento', async () => {
    mockFrom.mockReturnValue(buildChain({ id: 'w1', event_id: 'evt1', opens_at: '2026-09-06T10:00:00.000Z', closes_at: '2026-09-16T10:00:00.000Z' }));
    const result = await getEventWindow('evt1');
    expect(result.window?.opens_at).toBe('2026-09-06T10:00:00.000Z');
  });
});

describe('updateEventNames', () => {
  it('aggiorna nome+cognome+role dei due partner e calcola couple_name', async () => {
    mockFrom.mockReturnValue(buildChain(null));
    const { updateEventNames } = await import('../service');
    const result = await updateEventNames('evt1', {
      groom1_first_name: 'Marco',
      groom1_last_name: 'Rossi',
      groom1_role: 'groom',
      groom2_first_name: 'Luca',
      groom2_last_name: 'Bianchi',
      groom2_role: 'groom',
    });
    expect(result.error).toBeUndefined();
    expect(result.couple_name).toBe('Marco Rossi & Luca Bianchi');
  });

  it('accetta coppia mista (bride + groom)', async () => {
    mockFrom.mockReturnValue(buildChain(null));
    const { updateEventNames } = await import('../service');
    const result = await updateEventNames('evt1', {
      groom1_first_name: 'Giulia',
      groom1_last_name: 'Verdi',
      groom1_role: 'bride',
      groom2_first_name: 'Marco',
      groom2_last_name: 'Rossi',
      groom2_role: 'groom',
    });
    expect(result.couple_name).toBe('Giulia Verdi & Marco Rossi');
  });

  it('ritorna couple_name null se tutti i nomi sono vuoti', async () => {
    mockFrom.mockReturnValue(buildChain(null));
    const { updateEventNames } = await import('../service');
    const result = await updateEventNames('evt1', {
      groom1_first_name: null,
      groom1_last_name: null,
      groom1_role: 'groom',
      groom2_first_name: null,
      groom2_last_name: null,
      groom2_role: 'groom',
    });
    expect(result.couple_name).toBeNull();
  });
});
