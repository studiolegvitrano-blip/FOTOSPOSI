import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
};

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

function buildChain(val: any) {
  return {
    select: () => ({
      eq: () => ({
        gte: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: val, error: null }),
          order: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: val, error: null }) }),
        }),
      }),
    }),
    insert: () => ({
      select: () => ({
        single: vi.fn().mockResolvedValue({ data: val, error: null }),
      }),
    }),
  };
}

vi.mock('../supabase', () => ({
  createClient: () => ({ auth: mockAuth }),
  createServiceClient: () => ({ from: mockFrom, auth: mockAuth }),
  createServerSideClient: () => ({ auth: mockAuth }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { signUp, signIn, signOut, getCurrentUser, validateQrToken, createQrToken } = await import('../auth');

describe('signUp', () => {
  it('chiama supabase.auth.signUp con email, password e nome', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const result = await signUp('test@test.com', 'password123', 'Mario');
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'password123',
      options: { data: { name: 'Mario' } },
    });
    expect(result.data.user.id).toBe('u1');
  });

  it('ritorna errore se signUp fallisce', async () => {
    mockAuth.signUp.mockResolvedValue({ data: null, error: { message: 'Email già in uso' } });
    const result = await signUp('test@test.com', 'pwd', 'Mario');
    expect(result.error.message).toBe('Email già in uso');
  });
});

describe('signIn', () => {
  it('chiama signInWithPassword con email e password', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const result = await signIn('a@b.com', 'pwd');
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pwd' });
  });
});

describe('signOut', () => {
  it('chiama supabase.auth.signOut', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });
    const result = await signOut();
    expect(mockAuth.signOut).toHaveBeenCalledOnce();
    expect(result.error).toBeNull();
  });
});

describe('getCurrentUser', () => {
  it('ritorna utente corrente', async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const result = await getCurrentUser();
    expect(result.user?.id).toBe('u1');
  });
});

describe('validateQrToken', () => {
  it('ritorna valid=true per token valido', async () => {
    const chain = buildChain({ event_id: 'evt1', role: 'invitato' });
    mockFrom.mockReturnValue(chain);
    const result = await validateQrToken('token-valido');
    expect(result.valid).toBe(true);
    expect(result.event_id).toBe('evt1');
  });

  it('ritorna valid=false se maybeSingle dà errore', async () => {
    const chain = {
      select: () => ({
        eq: () => ({
          gte: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'errore' } }),
          }),
        }),
      }),
    };
    mockFrom.mockReturnValue(chain);
    const result = await validateQrToken('inesistente');
    expect(result.valid).toBe(false);
  });
});

describe('createQrToken', () => {
  it('crea un token e lo ritorna', async () => {
    const chain = {
      insert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'tok1', event_id: 'evt1', token: 'abc-123', role: 'invitato' }, error: null }),
        }),
      }),
    };
    mockFrom.mockReturnValue(chain);
    const result = await createQrToken('evt1', 'invitato', new Date('2026-07-15'));
    expect(result.token?.event_id).toBe('evt1');
  });

  it('ritorna errore se insert fallisce', async () => {
    const chain = {
      insert: () => ({
        select: () => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    };
    mockFrom.mockReturnValue(chain);
    const result = await createQrToken('evt1', 'invitato', new Date('2026-07-15'));
    expect(result.error).toBe('DB error');
  });
});
