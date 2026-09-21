import { describe, it, expect } from 'vitest';
import {
  computeCapsulePriceCents,
  capsulePaymentRequired,
  clampCapsuleMonths,
  buildCapsuleWatermarkText,
  CAPSULE_MIN_MONTHS,
  CAPSULE_MAX_MONTHS,
  FRASE_NOSTRA_WATERMARK,
} from './index';

describe('computeCapsulePriceCents', () => {
  it('6 mesi → prezzo base (900)', () => {
    expect(computeCapsulePriceCents(6).cents).toBe(900);
  });

  it('12 mesi → ancora base (900)', () => {
    expect(computeCapsulePriceCents(12).cents).toBe(900);
  });

  it('13 mesi → base + 1 mese extra (1000)', () => {
    expect(computeCapsulePriceCents(13).cents).toBe(1000);
  });

  it('24 mesi → base + 12 mesi extra (2100)', () => {
    expect(computeCapsulePriceCents(24).cents).toBe(2100);
  });

  it('60 mesi (5 anni) → base + 48 mesi extra (5700)', () => {
    expect(computeCapsulePriceCents(60).cents).toBe(5700);
  });

  it('proporzionale: 5 anni = base + 4×(extra 12 mesi)', () => {
    const base = computeCapsulePriceCents(12).cents;
    const oneYearExtra = computeCapsulePriceCents(24).cents - base;
    expect(computeCapsulePriceCents(60).cents).toBe(base + 4 * oneYearExtra);
  });

  it('clamp: sotto i 6 mesi torna comunque il minimo', () => {
    expect(computeCapsulePriceCents(1).months).toBe(CAPSULE_MIN_MONTHS);
  });

  it('clamp: oltre i 60 mesi torna comunque il massimo', () => {
    expect(computeCapsulePriceCents(120).months).toBe(CAPSULE_MAX_MONTHS);
  });

  it('override importi (platform_settings)', () => {
    expect(computeCapsulePriceCents(12, { baseEur: 5, perMonthEur: 2 }).cents).toBe(500);
    expect(computeCapsulePriceCents(24, { baseEur: 5, perMonthEur: 2 }).cents).toBe(2900);
  });

  it('errore su durata non numerica', () => {
    expect(computeCapsulePriceCents(NaN).error).toBeTruthy();
  });
});

describe('capsulePaymentRequired', () => {
  it('invitato → sempre a pagamento, anche sotto i 12 mesi', () => {
    expect(capsulePaymentRequired('invitato', 6)).toBe(true);
    expect(capsulePaymentRequired('invitato', 12)).toBe(true);
    expect(capsulePaymentRequired('invitato', 60)).toBe(true);
  });

  it('sposo → gratis fino a 12 mesi, a pagamento oltre', () => {
    expect(capsulePaymentRequired('sposo', 6)).toBe(false);
    expect(capsulePaymentRequired('sposo', 12)).toBe(false);
    expect(capsulePaymentRequired('sposo', 13)).toBe(true);
    expect(capsulePaymentRequired('sposo', 60)).toBe(true);
  });

  it('sposa → stesso comportamento dello sposo', () => {
    expect(capsulePaymentRequired('sposa', 12)).toBe(false);
    expect(capsulePaymentRequired('sposa', 24)).toBe(true);
  });
});

describe('buildCapsuleWatermarkText', () => {
  it('frase utente + frase nostra', () => {
    expect(buildCapsuleWatermarkText('Ci vediamo tra un anno')).toBe(
      `Ci vediamo tra un anno · ${FRASE_NOSTRA_WATERMARK}`,
    );
  });

  it('senza frase utente → solo frase nostra', () => {
    expect(buildCapsuleWatermarkText(null)).toBe(FRASE_NOSTRA_WATERMARK);
    expect(buildCapsuleWatermarkText('   ')).toBe(FRASE_NOSTRA_WATERMARK);
  });

  it('la frase utente è trimmata', () => {
    expect(buildCapsuleWatermarkText('  Ciao  ')).toBe(`Ciao · ${FRASE_NOSTRA_WATERMARK}`);
  });
});

describe('clampCapsuleMonths', () => {
  it('arrotonda e clamp 6..60', () => {
    expect(clampCapsuleMonths(6.4)).toBe(6);
    expect(clampCapsuleMonths(12.5)).toBe(13);
    expect(clampCapsuleMonths(3)).toBe(6);
    expect(clampCapsuleMonths(72)).toBe(60);
  });
});
