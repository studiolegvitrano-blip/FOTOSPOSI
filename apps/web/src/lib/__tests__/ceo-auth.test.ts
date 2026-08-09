import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateCeoPasswordPolicy,
  signCeoSession,
  verifyCeoSession,
  ceoPasswordMatches,
  isCeoPasswordConfigured,
  ceoTokenFromCookies,
  CEO_COOKIE,
} from '../ceo-auth';

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env.CEO_PASSWORD = '';
});

afterEach(() => {
  process.env.CEO_PASSWORD = ORIG_ENV.CEO_PASSWORD;
});

describe('validateCeoPasswordPolicy', () => {
  it('accetta una password con 8+ char, maiuscola, minuscola, numero, simbolo', () => {
    expect(validateCeoPasswordPolicy('Ceo!2026x').ok).toBe(true);
  });

  it('rifiuta password troppo corta', () => {
    const r = validateCeoPasswordPolicy('Ceo!202');
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('almeno 8 caratteri');
  });

  it('rifiuta senza maiuscola', () => {
    expect(validateCeoPasswordPolicy('ceo!2026x').errors).toContain('una lettera maiuscola');
  });

  it('rifiuta senza minuscola', () => {
    expect(validateCeoPasswordPolicy('CEO!2026X').errors).toContain('una lettera minuscola');
  });

  it('rifiuta senza numero', () => {
    expect(validateCeoPasswordPolicy('Ceo!Testx').errors).toContain('un numero');
  });

  it('rifiuta senza simbolo', () => {
    expect(validateCeoPasswordPolicy('Ceo2026xx').errors).toContain('un simbolo (es. !@#$%^&*)');
  });

  it('accumula tutti gli errori', () => {
    const r = validateCeoPasswordPolicy('short');
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('signCeoSession / verifyCeoSession', () => {
  it('firma e verifica una sessione valida', async () => {
    process.env.CEO_PASSWORD = 'Ceo!2026x';
    const token = await signCeoSession();
    expect(await verifyCeoSession(token)).toBe(true);
  });

  it('rifiuta token con firma manomessa', async () => {
    process.env.CEO_PASSWORD = 'Ceo!2026x';
    const token = await signCeoSession();
    const tampered = token.slice(0, -3) + (token.endsWith('abc') ? 'xyz' : 'abc');
    expect(await verifyCeoSession(tampered)).toBe(false);
  });

  it('rifiuta token scaduto (exp nel passato)', async () => {
    process.env.CEO_PASSWORD = 'Ceo!2026x';
    const token = await signCeoSession();
    expect(await verifyCeoSession(token, Date.now() + 1000 * 60 * 60 * 13)).toBe(false);
  });

  it('rifiuta token con formato non valido', async () => {
    expect(await verifyCeoSession('nope')).toBe(false);
    expect(await verifyCeoSession(undefined)).toBe(false);
  });

  it('invalida le sessioni se la password cambia', async () => {
    process.env.CEO_PASSWORD = 'Ceo!2026x';
    const token = await signCeoSession();
    process.env.CEO_PASSWORD = 'Altro!2026x';
    expect(await verifyCeoSession(token)).toBe(false);
  });
});

describe('ceoPasswordMatches', () => {
  it('confronta in timing-safe password corretta', () => {
    process.env.CEO_PASSWORD = 'Ceo!2026x';
    expect(ceoPasswordMatches('Ceo!2026x')).toBe(true);
  });

  it('rifiuta password errata', () => {
    process.env.CEO_PASSWORD = 'Ceo!2026x';
    expect(ceoPasswordMatches('wrong')).toBe(false);
  });

  it('rifiuta se CEO_PASSWORD non configurata', () => {
    expect(ceoPasswordMatches('Ceo!2026x')).toBe(false);
  });
});

describe('isCeoPasswordConfigured', () => {
  it('reporta configured=false senza env', () => {
    expect(isCeoPasswordConfigured()).toEqual({ configured: false, policyOk: false });
  });

  it('reporta policyOk=false con password debole', () => {
    process.env.CEO_PASSWORD = 'weak';
    expect(isCeoPasswordConfigured()).toEqual({ configured: true, policyOk: false });
  });

  it('reporta tutto ok con password forte', () => {
    process.env.CEO_PASSWORD = 'Ceo!2026x';
    expect(isCeoPasswordConfigured()).toEqual({ configured: true, policyOk: true });
  });
});

describe('ceoTokenFromCookies', () => {
  it('estrae il token dal cookie header', async () => {
    process.env.CEO_PASSWORD = 'Ceo!2026x';
    const token = await signCeoSession();
    const header = `other=1; ${CEO_COOKIE}=${token}; foo=2`;
    expect(ceoTokenFromCookies(header)).toBe(token);
  });

  it('ritorna null senza header', () => {
    expect(ceoTokenFromCookies(undefined)).toBeNull();
  });

  it('ritorna null se il cookie non c\'è', () => {
    expect(ceoTokenFromCookies('foo=bar')).toBeNull();
  });
});
