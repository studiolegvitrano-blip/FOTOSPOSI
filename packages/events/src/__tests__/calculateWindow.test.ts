import { describe, it, expect } from 'vitest';
import { calculateWindow } from '../index';

describe('calculateWindow', () => {
  it('calcola finestra 20gg: apre 18gg prima, chiude 2gg dopo', () => {
    const result = calculateWindow('2026-09-15T10:00:00.000Z');
    expect(result.opens_at).toBe('2026-08-28T10:00:00.000Z');
    expect(result.closes_at).toBe('2026-09-17T10:00:00.000Z');
  });

  it('finestra per data di capodanno', () => {
    const result = calculateWindow('2026-01-01T00:00:00.000Z');
    expect(result.opens_at).toBe('2025-12-14T00:00:00.000Z');
    expect(result.closes_at).toBe('2026-01-03T00:00:00.000Z');
  });

  it('gestisce orario diverso', () => {
    const result = calculateWindow('2026-06-30T14:30:00.000Z');
    expect(result.opens_at).toBe('2026-06-12T14:30:00.000Z');
    expect(result.closes_at).toBe('2026-07-02T14:30:00.000Z');
  });
});
