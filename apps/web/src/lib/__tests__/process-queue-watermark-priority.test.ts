import { describe, it, expect } from 'vitest';
import { composeWatermarkLine1 } from '../process-queue';

/**
 * FIX 29/07/2026 — bug regressione: il watermark applicato alle foto era il
 * "Marco ❤ Luca" hardcoded della sessione 27/07 invece del testo custom
 * "W gli Sposi! Marco & Luca 30/07/2026 ❤" impostato dall'utente nei settings.
 *
 * Priorità INVERTITA:
 *   1. watermark_text custom (se non vuoto) → VINCE su tutto
 *   2. Nomi separati groom1+groom2 → formattati "Nome Cognome ❤ Nome Cognome"
 *   3. Fallback couple_name
 *   4. watermark_names=false → stringa vuota
 */
describe('composeWatermarkLine1 — priorità watermark custom vs nomi separati', () => {
  it('watermark_text custom ha la precedenza sui nomi separati', () => {
    const result = composeWatermarkLine1({
      watermark_text: 'W gli Sposi! Agostino Spera & Danila Villa 30/07/2026 ❤️',
      groom1_first_name: 'Agostino',
      groom1_last_name: 'Spera',
      groom2_first_name: 'Danila',
      groom2_last_name: 'Villa',
      couple_name: 'Agostino Spera & Danila Villa',
    });
    expect(result).toBe('W gli Sposi! Agostino Spera & Danila Villa 30/07/2026 ❤️');
    // Non deve vincere la composizione automatica nomi+cuore
    expect(result).not.toContain('Agostino Spera ❤ Danila Villa');
  });

  it('caduta su nomi separati solo se watermark_text vuoto', () => {
    const result = composeWatermarkLine1({
      watermark_text: '',
      groom1_first_name: 'Marco',
      groom1_last_name: 'Rossi',
      groom2_first_name: 'Luca',
      groom2_last_name: 'Bianchi',
      couple_name: 'Marco Rossi & Luca Bianchi',
    });
    expect(result).toBe('Marco Rossi ❤ Luca Bianchi');
  });

  it('caduta su nomi separati anche se watermark_text solo whitespace', () => {
    const result = composeWatermarkLine1({
      watermark_text: '   \n  ',
      groom1_first_name: 'A',
      groom2_first_name: 'B',
    });
    expect(result).toBe('A ❤ B');
  });

  it('caduta su couple_name se customText vuoto e nomi separati mancanti', () => {
    const result = composeWatermarkLine1({
      watermark_text: '',
      couple_name: 'Marco & Luca',
    });
    expect(result).toBe('Marco & Luca');
  });

  it('watermark_names=false → stringa vuota anche con customText presente', () => {
    const result = composeWatermarkLine1({
      watermark_names: false,
      watermark_text: 'Qualsiasi cosa',
      groom1_first_name: 'A',
      groom2_first_name: 'B',
      couple_name: 'C',
    });
    expect(result).toBe('');
  });

  it('watermark_names=true esplicito + customText → usa customText', () => {
    const result = composeWatermarkLine1({
      watermark_names: true,
      watermark_text: 'custom vince',
      groom1_first_name: 'A',
      groom2_first_name: 'B',
    });
    expect(result).toBe('custom vince');
  });

  it('watermark_names undefined (default) → si comporta come true', () => {
    const result = composeWatermarkLine1({
      watermark_text: 'testo custom',
    });
    expect(result).toBe('testo custom');
  });

  it('event null/undefined → stringa vuota', () => {
    expect(composeWatermarkLine1(null)).toBe('');
    expect(composeWatermarkLine1(undefined)).toBe('');
  });

  it('event vuoto senza nessun campo valorizzato → stringa vuota', () => {
    expect(composeWatermarkLine1({})).toBe('');
  });

  it('solo primo groom valorizzato + customText vuoto → cade su couple_name', () => {
    const result = composeWatermarkLine1({
      groom1_first_name: 'Solo Nome',
      couple_name: 'Solo Nome',
    });
    expect(result).toBe('Solo Nome');
  });

  it('solo secondo groom valorizzato + customText vuoto → cade su couple_name', () => {
    const result = composeWatermarkLine1({
      groom2_first_name: 'Solo Nome 2',
      couple_name: 'Legacy',
    });
    expect(result).toBe('Legacy');
  });

  it('trim applicato su customText e su tutti i campi', () => {
    const result = composeWatermarkLine1({
      watermark_text: '   testo con spazi   ',
    });
    expect(result).toBe('testo con spazi');
  });

  it('simula scenario utente: Agostino e Danila 29/07/2026', () => {
    // Caso esatto riportato dall'utente nel messaggio di sessione
    const result = composeWatermarkLine1({
      watermark_names: true,
      watermark_text: 'W gli Sposi! Agostino Spera & Danila Villa 30/07/2026 ❤️',
      groom1_first_name: 'Agostino',
      groom1_last_name: 'Spera',
      groom2_first_name: 'Danila',
      groom2_last_name: 'Villa',
      couple_name: 'Agostino Spera & Danila Villa',
    });
    expect(result).toBe('W gli Sposi! Agostino Spera & Danila Villa 30/07/2026 ❤️');
    expect(result).toMatch(/❤️/);
    expect(result).toMatch(/30\/07\/2026/);
  });
});
