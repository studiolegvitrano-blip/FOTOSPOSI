import { describe, it, expect } from 'vitest';
import { calculateWindow } from '../index';

describe('calculateWindow', () => {
  it('calcola finestra 10gg: apre 9gg prima, chiude 1gg dopo', () => {
    const result = calculateWindow('2026-09-15T10:00:00.000Z');
    expect(result.opens_at).toBe('2026-09-06T10:00:00.000Z');
    expect(result.closes_at).toBe('2026-09-16T10:00:00.000Z');
  });

  it('finestra per data di capodanno', () => {
    const result = calculateWindow('2026-01-01T00:00:00.000Z');
    expect(result.opens_at).toBe('2025-12-23T00:00:00.000Z');
    expect(result.closes_at).toBe('2026-01-02T00:00:00.000Z');
  });

  it('gestisce orario diverso', () => {
    const result = calculateWindow('2026-06-30T14:30:00.000Z');
    expect(result.opens_at).toBe('2026-06-21T14:30:00.000Z');
    expect(result.closes_at).toBe('2026-07-01T14:30:00.000Z');
  });
});
