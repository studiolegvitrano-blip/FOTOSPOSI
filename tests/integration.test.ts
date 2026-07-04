import { describe, it, expect, vi, beforeEach } from 'vitest';

type Chainable = any;
const queries = new Map<string, any>();

function chain(val: any): Chainable {
  const p = Promise.resolve({ data: val, error: null }) as any;
  p.eq = vi.fn(() => chain(val));
  p.single = vi.fn().mockResolvedValue({ data: val, error: null });
  p.maybeSingle = vi.fn().mockResolvedValue({ data: val, error: null });
  p.order = vi.fn(() => chain(val));
  p.limit = vi.fn(() => chain(val));
  p.select = vi.fn(() => chain(val));
  p.insert = vi.fn(() => chain(val));
  p.upsert = vi.fn(() => chain(val));
  p.update = vi.fn(() => chain(val));
  p.delete = vi.fn(() => chain(val));
  p.gt = vi.fn(() => chain(val));
  p.in = vi.fn(() => chain(val));
  p.textSearch = vi.fn(() => chain(val));
  p.range = vi.fn(() => chain(val));
  return p;
}

vi.mock('@fotosposi/core', () => ({
  createClient: () => ({
    from: (table: string) => queries.get(table) ?? chain([]),
    auth: {
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@a.it' } }, error: null }),
    },
  }),
  createServiceClient: () => ({ from: (table: string) => queries.get(table) ?? chain([]) }),
  createServerSideClient: () => ({ from: (table: string) => queries.get(table) ?? chain([]), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) } }),
  generateChat: vi.fn().mockResolvedValue({ content: 'Risposta AI mock', error: null }),
  generateText: vi.fn().mockResolvedValue({ content: 'Testo AI mock', error: null }),
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
  signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
  signIn: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  getCurrentUser: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'a@a.it' }, error: null }),
  createQrToken: vi.fn().mockResolvedValue({ token: 'abc', error: null }),
  validateQrToken: vi.fn().mockResolvedValue({ event_id: 'evt-1', role: 'invitato', error: null }),
  getEventTier: vi.fn().mockResolvedValue({ tier: 'free', error: null }),
  updateEventTier: vi.fn().mockResolvedValue({ tier: 'premium', error: null }),
  hasFeature: vi.fn().mockResolvedValue(true),
  TIERS: { free: {}, premium: {}, deluxe: {} },
} as any));

function mockTable(table: string, data: any) {
  queries.set(table, chain(data));
}

beforeEach(() => { vi.clearAllMocks(); queries.clear(); });

// ─── SCENARIO 1: AUTH ──────────────────────────────────────────
describe('Scenario 1 — Auth', () => {
  it('signup, login, current user, logout', async () => {
    const { signUp, signIn, getCurrentUser, signOut } = await import('@fotosposi/core');
    expect((await signUp('a@a.it', 'pw', 'Test')).data).toBeDefined();
    expect((await signIn('a@a.it', 'pw')).data).toBeDefined();
    expect((await getCurrentUser()).user).toBeDefined();
    expect((await signOut()).error).toBeNull();
  });
});

// ─── SCENARIO 2: EVENT ─────────────────────────────────────────
describe('Scenario 2 — Event CRUD', () => {
  const evt = { id: 'evt-1', couple_name: 'Mario & Anna', date: '2026-09-15', location: 'Roma', brand: 'fotosposi', tier: 'free', code: 'EV_IT001', tenant_id: 't1', created_by: 'u1', created_at: new Date().toISOString() };

  it('creates', async () => {
    mockTable('event_codes', { sequence: 1, code: 'EV_IT001' });
    mockTable('events', evt);
    const { createEvent } = await import('@fotosposi/events');
    const r = await createEvent({ couple_name: 'Mario & Anna', date: '2026-09-15', location: 'Roma', tenant_id: 't1', created_by: 'u1', brand: 'fotosposi' });
    expect(r.event?.couple_name).toBe('Mario & Anna');
  });

  it('reads', async () => {
    mockTable('events', evt);
    const { getEventById } = await import('@fotosposi/events');
    expect((await getEventById('evt-1')).event?.id).toBe('evt-1');
  });

  it('lists', async () => {
    const { getEventsByUser } = await import('@fotosposi/events');
    mockTable('event_managers', [{ event_id: 'evt-1' }]);
    mockTable('events', [evt]);
    const r = await getEventsByUser('u1');
    expect(r.events).toHaveLength(1);
  });
});

// ─── SCENARIO 3: WATERMARK ─────────────────────────────────────
describe('Scenario 3 — Watermark', () => {
  it('applyOverlay via sharp', async () => {
    const sharp = (await import('sharp')).default;
    const img = await sharp(Buffer.from('<svg width="200" height="200"><rect width="200" height="200" fill="orange"/></svg>')).png().toBuffer();
    const { applyOverlay } = await import('@fotosposi/photo-overlay');
    const r = await applyOverlay(img, { format: 'square', branding: { coupleNames: 'Mario & Anna', date: '15/09/2026', primaryColor: '#d4a574', wordmark: 'Sposi.live' } });
    expect(r).toBeInstanceOf(Buffer);
    expect(r.length).toBeGreaterThan(200);
  });
});

// ─── SCENARIO 4: GTE ───────────────────────────────────────────
describe('Scenario 4 — GTE pipeline', () => {
  it('brand config', async () => {
    mockTable('brand_config', { id: 'b1', slug: 'justmarrylive', name: 'JustMarry.live' });
    const { getBrandConfig } = await import('@fotosposi/gte');
    expect((await getBrandConfig('justmarrylive')).config?.name).toBe('JustMarry.live');
  });

  it('UGC', async () => {
    mockTable('media_uploads', [{ id: 'm1', file_type: 'photo', events: { couple_name: 'Test' } }]);
    const { getUGCForPipeline } = await import('@fotosposi/gte');
    expect((await getUGCForPipeline({ limit: 5 })).ugc).toHaveLength(1);
  });

  it('engagement', async () => {
    mockTable('engagement_triage', { id: 'e1', platform: 'instagram' });
    const { recordEngagement } = await import('@fotosposi/gte');
    expect((await recordEngagement({ brand_id: 'b1', platform: 'instagram', message_text: 'Ciao' })).record?.platform).toBe('instagram');
  });

  it('B2B leads CRUD', async () => {
    mockTable('b2b_leads', [{ id: 'l1', contact_status: 'new' }]);
    const { getB2BLeads } = await import('@fotosposi/gte');
    expect((await getB2BLeads({ status: 'new' })).leads).toHaveLength(1);
    mockTable('b2b_leads', { id: 'l1', contact_status: 'contacted' });
    const { updateLeadStatus } = await import('@fotosposi/gte');
    expect((await updateLeadStatus('l1', 'contacted')).lead?.contact_status).toBe('contacted');
  });
});

// ─── SCENARIO 5: CONCIERGE ─────────────────────────────────────
describe('Scenario 5 — Concierge AI', () => {
  it('send + history', async () => {
    mockTable('concierge_messages', { id: 'cm1', role: 'user', content: 'Ciao' });
    const { sendMessage, getMessages } = await import('@fotosposi/concierge');
    expect((await sendMessage({ event_id: 'evt-1', user_id: 'u1', role: 'user', content: 'Ciao' })).message?.role).toBe('user');
    mockTable('concierge_messages', [{ id: 'cm2', role: 'assistant', content: 'Ciao!' }]);
    expect((await getMessages('evt-1', 'u1')).messages).toHaveLength(1);
  });
});

// ─── SCENARIO 6: MEDIA ─────────────────────────────────────────
describe('Scenario 6 — Media upload', () => {
  it('create media record', async () => {
    mockTable('media_uploads', { id: 'm1', event_id: 'evt-1', type: 'photo' });
    const { createMediaRecord } = await import('@fotosposi/media');
    const r = await createMediaRecord({ event_id: 'evt-1', uploaded_by: 'u1', type: 'photo', url: 'r2k', r2_key: 'r2k' });
    expect(r.media?.type).toBe('photo');
  });
});

// ─── SCENARIO 7: GAMES ─────────────────────────────────────────
describe('Scenario 7 — Games', () => {
  it('photo hunt', async () => {
    mockTable('photo_hunt_registrations', { id: 'ph1' });
    const { registerForPhotoHunt } = await import('@fotosposi/games');
    expect((await registerForPhotoHunt({ event_id: 'evt-1', user_id: 'u1' })).registration).toBeDefined();

    mockTable('photo_hunt_tasks', [{ id: 't1', label: 'Selfie' }]);
    const { getPhotoHuntTasks } = await import('@fotosposi/games');
    expect((await getPhotoHuntTasks('evt-1')).tasks).toHaveLength(1);
  });

  it('dress vote', async () => {
    mockTable('dress_votes', [{ vote_type: 'sposo', rating: 5 }, { vote_type: 'sposa', rating: 4 }]);
    const { getDressVoteStats, castDressVote } = await import('@fotosposi/games');

    const stats = await getDressVoteStats('evt-1');
    expect(stats.sposo).toBeDefined();
    expect(stats.sposo?.avg).toBe(5);
    expect(stats.sposa?.avg).toBe(4);

    mockTable('dress_votes', { id: 'dv1', vote_sposo: 5, vote_sposa: 4 });
    const vote = await castDressVote({ event_id: 'evt-1', user_id: 'u1', vote_sposo: 5, vote_sposa: 4 });
    expect(vote.vote?.vote_sposo).toBe(5);
  });
});

// ─── SCENARIO 8: NOTIFICHE ─────────────────────────────────────
describe('Scenario 8 — Notifiche', () => {
  it('preferences + send', async () => {
    mockTable('notification_preferences', [{ id: 'p1', channel: 'email', enabled: true }]);
    const { getPreferences, updatePreference } = await import('@fotosposi/notifications');
    expect((await getPreferences('evt-1')).prefs).toHaveLength(1);
    mockTable('notification_preferences', null);
    expect((await updatePreference('evt-1', 'email', true)).error).toBeUndefined();

    mockTable('notification_log', { id: 'n1', channel: 'email', status: 'failed' });
    const { sendNotification } = await import('@fotosposi/notifications');
    const r = await sendNotification({ event_id: 'evt-1', channel: 'email', recipient: 'a@a.it', subject: 'Test', body: 'Test' });
    expect(r.log?.channel).toBe('email');
  });
});
