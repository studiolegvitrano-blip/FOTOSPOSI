import { describe, it, expect } from 'vitest';
import { coupleNameToHashtag, buildShareText, buildDefaultCaption } from '../share-with-tags';

describe('coupleNameToHashtag', () => {
  it('converte "Elisa & Nausica" → #ElisaENausica (& → E, non "and")', () => {
    expect(coupleNameToHashtag('Elisa & Nausica')).toBe('#ElisaENausica');
  });

  it('rimuove spazi e caratteri speciali', () => {
    expect(coupleNameToHashtag('Giulia & Marco')).toBe('#GiuliaEMarco');
    expect(coupleNameToHashtag('  Mario   Rossi  ')).toBe('#MarioRossi');
  });

  it('non duplica # già presente', () => {
    expect(coupleNameToHashtag('#Matri2026')).toBe('#Matri2026');
  });

  it('ritorna null per input vuoto/null', () => {
    expect(coupleNameToHashtag(null)).toBeNull();
    expect(coupleNameToHashtag(undefined)).toBeNull();
    expect(coupleNameToHashtag('')).toBeNull();
    expect(coupleNameToHashtag('&&&')).toBe('#EEE');
  });
});

describe('hashtag con & (bug #Anna&Marcosposi → & rompe l\u2019hashtag sui social)', () => {
  it('coupleHashtag con & → & strippato da normalizeHashtag', () => {
    const text = buildShareText({
      userText: 'Test',
      coupleHashtag: '#Anna&Marcosposi',
      photoUrl: 'https://example.com/x.jpg',
      brand: 'sposilive',
    });
    expect(text).toContain('#AnnaMarcosposi');
    expect(text).not.toContain('&');
  });

  it('hashtag con accenti → diacritici rimossi (gli hashtag social non li accettano)', () => {
    const text = buildShareText({
      userText: 'Test',
      coupleHashtag: '#MatrìmonioSposi',
      photoUrl: 'https://example.com/x.jpg',
      brand: 'sposilive',
    });
    expect(text).toContain('#MatrimonioSposi');
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

describe('buildShareText con hashtag generici (richiesta 22/09/2026)', () => {
  it('sposilive: include #Matrimonio #Nozze #Wedding', () => {
    const text = buildShareText({
      userText: 'Test',
      coupleHashtag: '#ElisaandNausica',
      photoUrl: 'https://example.com/x.jpg',
      brand: 'sposilive',
    });
    expect(text).toContain('#Matrimonio');
    expect(text).toContain('#Nozze');
    expect(text).toContain('#Wedding');
  });

  it('justmarry: include #Wedding #WeddingItaly (no #Matrimonio IT)', () => {
    const text = buildShareText({
      userText: 'Test',
      photoUrl: 'https://example.com/x.jpg',
      brand: 'justmarry',
    });
    expect(text).toContain('#WeddingItaly');
    expect(text).toContain('#Wedding');
    expect(text).not.toContain('#Matrimonio');
  });
});

describe('buildDefaultCaption', () => {
  it('didascalia precompilata con nome coppia', () => {
    const caption = buildDefaultCaption('Elisa & Marco');
    expect(caption).toContain('Elisa & Marco');
    expect(caption).toContain('💍');
    expect(caption.split('\n').length).toBeGreaterThan(1);
  });

  it('vuota senza nome coppia (nessun testo inventato)', () => {
    expect(buildDefaultCaption(null)).toBe('');
    expect(buildDefaultCaption('   ')).toBe('');
  });
});