/**
 * Capsula del Tempo — prezzi proporzionali al tempo (feature 18/09/2026).
 *
 * Scala UNICA per sposi e invitati, da 6 mesi a 5 anni dalla data di inserimento:
 *   - base (6-12 mesi): CAPSULE_PRICE_BASE_EUR
 *   - ogni mese oltre i 12: CAPSULE_PRICE_PER_MONTH_EUR
 *
 * Regole di pagamento:
 *   - SPOSI: gratis fino a 12 mesi; oltre, extra proporzionale (dopo 1 anno).
 *   - INVITATI: SEMPRE a pagamento (stessa scala).
 *
 * Importi default in codice: volerli cambiare senza deploy, leggere
 * platform_settings (chiavi 'capsule_price_base_eur' / 'capsule_price_per_month_eur')
 * e passarli come override a computeCapsulePriceCents.
 */

export const CAPSULE_MIN_MONTHS = 6;
export const CAPSULE_MAX_MONTHS = 60;
export const CAPSULE_FREE_MONTHS = 12;
export const CAPSULE_PRICE_BASE_EUR = 9;
export const CAPSULE_PRICE_PER_MONTH_EUR = 1;

export interface CapsulePriceOptions {
  baseEur?: number;
  perMonthEur?: number;
}

export function clampCapsuleMonths(months: number): number {
  return Math.min(CAPSULE_MAX_MONTHS, Math.max(CAPSULE_MIN_MONTHS, Math.round(months)));
}

export function computeCapsulePriceCents(
  months: number,
  opts?: CapsulePriceOptions,
): { cents: number; months: number; error?: string } {
  const baseEur = opts?.baseEur ?? CAPSULE_PRICE_BASE_EUR;
  const perMonthEur = opts?.perMonthEur ?? CAPSULE_PRICE_PER_MONTH_EUR;
  if (!Number.isFinite(months)) return { cents: 0, months: 0, error: 'Durata non valida' };
  const clamped = clampCapsuleMonths(months);
  const extraMonths = Math.max(0, clamped - CAPSULE_FREE_MONTHS);
  const cents = Math.round((baseEur + perMonthEur * extraMonths) * 100);
  return { cents, months: clamped };
}

/**
 * Se la capsula richiede pagamento:
 *   - invitato → sempre
 *   - sposo → solo oltre i 12 mesi (extra proporzionale)
 */
export function capsulePaymentRequired(senderType: string, months: number): boolean {
  if (senderType === 'invitato') return true;
  return clampCapsuleMonths(months) > CAPSULE_FREE_MONTHS;
}

export function formatCapsulePrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}
