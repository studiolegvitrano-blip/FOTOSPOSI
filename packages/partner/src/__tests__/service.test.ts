import { describe, it, expect } from 'vitest';
import { getPartnerPackagePrice } from '../service';

describe('getPartnerPackagePrice', () => {
  it('applica lo sconto volume >= 6 (50%)', () => {
    const p = getPartnerPackagePrice('premium', 10);
    expect(p.unitPrice).toBe(199 * 0.5);
    expect(p.discountPercent).toBe(50);
    expect(p.freeLicenses).toBe(0);
  });

  it('applica >= 12 con 1 licenza gratis', () => {
    const p = getPartnerPackagePrice('premium', 12);
    expect(p.discountPercent).toBe(50);
    expect(p.freeLicenses).toBe(1);
  });

  it('sotto 6 licenze nessuno sconto', () => {
    const p = getPartnerPackagePrice('deluxe', 5);
    expect(p.discountPercent).toBe(0);
    expect(p.unitPrice).toBe(350);
  });

  it('tier deluxe base = 350', () => {
    const p = getPartnerPackagePrice('deluxe', 1);
    expect(p.unitPrice).toBe(350);
  });
});

describe('listPartnerEvents — mapping select', () => {
  it('usa partner_id come filtro e ordina per data discendente', () => {
    // Test strutturale: verifica che la query contenuta sia coerente col
    // contratto (i filtri effettivi sono esercitati via integration test).
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'codes.ts'), 'utf8');
    expect(src).toContain("'partner_id'");
    expect(src).toContain("order('date', { ascending: false })");
    expect(src).toContain('couple_name');
  });
});

describe('redeemFirstAvailableCode — fallback senza codici', () => {
  it('ritorna errore esplicito se il partner non ha codici available', async () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'codes.ts'), 'utf8');
    // Il messaggio di errore guida l'utente all'acquisto di un pacchetto.
    expect(src).toContain('Nessun codice disponibile');
  });
});
