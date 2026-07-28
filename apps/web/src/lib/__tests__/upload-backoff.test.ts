import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global navigator prima dell'import (upload-queue.ts è 'use client').
// Il modulo verifica solo se `'serviceWorker' in navigator`, quindi basta un mock minimale.
(globalThis as any).navigator = { serviceWorker: undefined };

const { computeBackoffMs, BACKOFF_BASE_MS, BACKOFF_CAP_MS, BACKOFF_MAX_RETRIES } = await import('../upload-queue');

describe('computeBackoffMs', () => {
  beforeEach(() => {
    // Reset Math.random per test deterministici sul cap/base.
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('attempt 1: base 1s + jitter 0 = ~1000ms (con Math.random=0 → 1000ms esatto)', () => {
    expect(computeBackoffMs(1)).toBe(BACKOFF_BASE_MS);
  });

  it('attempt 2: esponente 2 → 2000ms', () => {
    expect(computeBackoffMs(2)).toBe(2 * BACKOFF_BASE_MS);
  });

  it('attempt 3: esponente 4 → 4000ms', () => {
    expect(computeBackoffMs(3)).toBe(4 * BACKOFF_BASE_MS);
  });

  it('attempt 6: esponente 32 → 32000ms', () => {
    expect(computeBackoffMs(6)).toBe(32 * BACKOFF_BASE_MS);
  });

  it('attempt 7+: capped a BACKOFF_CAP_MS', () => {
    expect(computeBackoffMs(7)).toBe(BACKOFF_CAP_MS);
    expect(computeBackoffMs(20)).toBe(BACKOFF_CAP_MS);
    expect(computeBackoffMs(100)).toBe(BACKOFF_CAP_MS);
  });

  it('retryCount 0: trattato come attempt 1 (base 1s, mai sotto il minimo)', () => {
    expect(computeBackoffMs(0)).toBe(BACKOFF_BASE_MS);
  });

  it('retryCount negativo: trattato come attempt 1 (no underflow)', () => {
    expect(computeBackoffMs(-5)).toBe(BACKOFF_BASE_MS);
  });

  it('jitter randomico aggiunge 0..BASE ms', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter = 0.5 * BASE = 500
    expect(computeBackoffMs(1)).toBe(BACKOFF_BASE_MS + Math.floor(0.5 * BACKOFF_BASE_MS));
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(computeBackoffMs(1)).toBe(BACKOFF_BASE_MS + Math.floor(0.999 * BACKOFF_BASE_MS));
    // jitter non può MAI superare BASE - 1 ms
    expect(computeBackoffMs(1)).toBeLessThan(BACKOFF_BASE_MS * 2);
  });

  it('esposizione costante: costante pubblicata per allineamento con SW', () => {
    expect(BACKOFF_BASE_MS).toBe(1000);
    expect(BACKOFF_CAP_MS).toBe(60000);
    expect(BACKOFF_MAX_RETRIES).toBeGreaterThan(0);
  });
});
