import { describe, it, expect } from 'vitest';
import { isGalleryVisibleRole, GALLERY_VISIBLE_ROLES, REGISTRATION_ROLES } from '../guest-roles';

describe('guest-roles', () => {
  it('mostra in galleria SOLO testimone sposa/sposo, padre, madre', () => {
    expect(GALLERY_VISIBLE_ROLES).toEqual(['testimone-sposa', 'testimone-sposo', 'padre', 'madre']);
  });

  it('isGalleryVisibleRole true per i 4 ruoli visualizzabili', () => {
    for (const r of GALLERY_VISIBLE_ROLES) expect(isGalleryVisibleRole(r)).toBe(true);
  });

  it('isGalleryVisibleRole false per i ruoli NON visualizzabili (amico, parente, altro, custom)', () => {
    expect(isGalleryVisibleRole('amico')).toBe(false);
    expect(isGalleryVisibleRole('parente')).toBe(false);
    expect(isGalleryVisibleRole('collega')).toBe(false);
    expect(isGalleryVisibleRole('cugino di Mario')).toBe(false);
  });

  it('isGalleryVisibleRole false per null, undefined, stringa vuota', () => {
    expect(isGalleryVisibleRole(null)).toBe(false);
    expect(isGalleryVisibleRole(undefined)).toBe(false);
    expect(isGalleryVisibleRole('')).toBe(false);
  });

  it('REGISTRATION_ROLES contiene tutti i ruoli e marca i 4 visualizzabili', () => {
    const values = REGISTRATION_ROLES.map((r) => r.value);
    expect(values).toContain('testimone-sposa');
    expect(values).toContain('testimone-sposo');
    expect(values).toContain('padre');
    expect(values).toContain('madre');
    expect(values).toContain('amico');
    expect(values).toContain('parente');
    expect(values).toContain('altro');
    const visible = REGISTRATION_ROLES.filter((r) => r.galleryVisible).map((r) => r.value);
    expect(visible).toEqual(['testimone-sposa', 'testimone-sposo', 'padre', 'madre']);
  });
});
