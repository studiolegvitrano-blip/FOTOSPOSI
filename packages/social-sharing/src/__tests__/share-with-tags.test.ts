import { describe, it, expect } from 'vitest';
import { coupleNameToHashtag, buildShareText } from '../share-with-tags';

describe('coupleNameToHashtag', () => {
  it('converte "Elisa & Nausica" → #ElisaandNausica', () => {
    expect(coupleNameToHashtag('Elisa & Nausica')).toBe('#ElisaandNausica');
  });

  it('rimuove spazi e caratteri speciali', () => {
    expect(coupleNameToHashtag('Giulia & Marco')).toBe('#GiuliaandMarco');
    expect(coupleNameToHashtag('  Mario   Rossi  ')).toBe('#MarioRossi');
  });

  it('non duplica # già presente', () => {
    expect(coupleNameToHashtag('#Matri2026')).toBe('#Matri2026');
  });

  it('ritorna null per input vuoto/null', () => {
    expect(coupleNameToHashtag(null)).toBeNull();
    expect(coupleNameToHashtag(undefined)).toBeNull();
    expect(coupleNameToHashtag('')).toBeNull();
    expect(coupleNameToHashtag('&&&')).toBe('#andandand');
  });
});

describe('buildShareText con coupleHashtag derivato', () => {
  it('include @sposilive e hashtag coppia senza @ davanti al nome', () => {
    const text = buildShareText({
      userText: 'Un giorno indimenticabile',
      coupleHashtag: '#ElisaandNausica',
      photoUrl: 'https://example.com/x.jpg',
      brand: 'sposilive',
    });
    expect(text).toContain('@sposilive');
    expect(text).toContain('#ElisaandNausica');
    expect(text).toContain('#sposilive');
    // il nome coppia NON deve comparire con @
    expect(text).not.toContain('@Elisa');
  });

  it('include @partner quando presente', () => {
    const text = buildShareText({
      userText: '',
      coupleHashtag: '#MarioRossi',
      partnerHandle: 'sartoriaitaliana',
      partnerHashtag: 'sartoria',
      photoUrl: 'https://example.com/x.jpg',
      brand: 'sposilive',
    });
    expect(text).toContain('@sartoriaitaliana');
    expect(text).toContain('#sartoria');
  });
});