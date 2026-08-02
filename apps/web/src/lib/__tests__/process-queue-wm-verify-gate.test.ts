/**
 * FIX 02/08/2026 — gate di verifica watermark allineato a come applyOverlay
 * renderizza davvero il testo.
 *
 * PRIMA: il gate richiedeva `hasHeart` per QUALSIASI testo (`namesOk =
 * !wmLine1 || presence.hasHeart`). Ma applyOverlay renderizza il cuore PNG
 * SOLO se `coupleNames` contiene `\u2764` (❤). Un evento con `watermark_text`
 * custom senza cuore (es. "Sabrina & Giulio Sposi Viareggio 01/08/2026") non
 * produce MAI un cuore → `hasHeart` sempre false → ogni foto riparata da
 * `repairWatermarkForEvent` veniva scartata con "watermark ancora assente
 * dopo repair" NONOSTANTE il testo fosse stato applicato (39 errori su 42).
 *
 * DOPO: `watermarkNamesOk` decide il segnale in base al contenuto:
 *   - wmLine1 vuoto → nessun nome atteso → OK.
 *   - wmLine1 con ❤ → applyOverlay disegna il cuore → richiede `hasHeart`.
 *   - wmLine1 senza ❤ → applyOverlay NON disegna cuori → richiede `hasNames`.
 */
import { describe, it, expect } from 'vitest';
import { watermarkNamesOk } from '../process-queue';

describe('watermarkNamesOk — gate di verifica watermark (FIX 02/08/2026)', () => {
  it('wmLine1 vuoto → OK (nessun nome atteso)', () => {
    expect(watermarkNamesOk('', { hasHeart: false, hasNames: false })).toBe(true);
  });

  it('testo con ❤ → richiede hasHeart', () => {
    expect(watermarkNamesOk('Agostino \u2764 Danila', { hasHeart: true, hasNames: false })).toBe(true);
    expect(watermarkNamesOk('Agostino \u2764 Danila', { hasHeart: false, hasNames: true })).toBe(false);
  });

  it('testo SENZA ❤ (watermark_text custom) → richiede hasNames, NON hasHeart', () => {
    // Caso reale dell'evento ee2cc954: testo custom senza cuore.
    const line1 = 'Sabrina & Giulio Sposi Viareggio 01/08/2026';
    // hasNames=true (testo applicato) ma hasHeart=false (nessun cuore disegnato)
    // → il gate deve PASSARE (era il bug: veniva scartato).
    expect(watermarkNamesOk(line1, { hasHeart: false, hasNames: true })).toBe(true);
    // Se manca anche il testo → fallisce (watermark davvero assente).
    expect(watermarkNamesOk(line1, { hasHeart: false, hasNames: false })).toBe(false);
  });

  it('testo senza ❤ ma con hasHeart da contenuto naturale → comunque OK se hasNames', () => {
    // hasHeart può essere true per contenuto rosso naturale della foto
    // (falso positivo del rilevamento cuore) — non deve cambiare il risultato.
    expect(watermarkNamesOk('W gli Sposi!', { hasHeart: true, hasNames: true })).toBe(true);
  });

  it('cuore con VARIANT SELECTOR (❤️ U+2764 U+FE0F) → tratta come ❤', () => {
    expect(watermarkNamesOk('Agostino \u2764\uFE0F Danila', { hasHeart: true, hasNames: false })).toBe(true);
  });
});
