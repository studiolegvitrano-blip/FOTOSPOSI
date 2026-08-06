import { describe, it, expect } from 'vitest';
import { validateGuests, validateIntolerances } from '../validation';

describe('validateIntolerances', () => {
  it('ritorna [] per undefined/null/stringa vuota', () => {
    expect(validateIntolerances(undefined)).toEqual([]);
    expect(validateIntolerances(null)).toEqual([]);
    expect(validateIntolerances('')).toEqual([]);
  });
  it('ritorna null se non array', () => {
    expect(validateIntolerances('Glutine')).toBeNull();
    expect(validateIntolerances({})).toBeNull();
    expect(validateIntolerances(42)).toBeNull();
  });
  it('ritorna null se un elemento non è stringa', () => {
    expect(validateIntolerances(['Glutine', 42])).toBeNull();
  });
  it('trimma e tronca a 80 char', () => {
    const long = 'x'.repeat(100);
    expect(validateIntolerances([long])).toEqual(['x'.repeat(80)]);
    expect(validateIntolerances(['  Pomodoro  '])).toEqual(['Pomodoro']);
  });
  it('filtra stringhe vuote dopo trim', () => {
    expect(validateIntolerances(['Lattosio', '   ', ''])).toEqual(['Lattosio']);
  });
  it('rifiuta più di 10 intolleranze', () => {
    const arr = Array.from({ length: 11 }, (_, i) => `I${i}`);
    expect(validateIntolerances(arr)).toBeNull();
  });
  it('accetta esattamente 10 intolleranze', () => {
    const arr = Array.from({ length: 10 }, (_, i) => `I${i}`);
    expect(validateIntolerances(arr)).toEqual(arr);
  });
});

describe('validateGuests', () => {
  it('ritorna [] per undefined/null', () => {
    expect(validateGuests(undefined)).toEqual([]);
    expect(validateGuests(null)).toEqual([]);
  });
  it('ritorna null se non array', () => {
    expect(validateGuests('ciao')).toBeNull();
    expect(validateGuests({})).toBeNull();
  });
  it('rifiuta più di 15 guests', () => {
    const arr = Array.from({ length: 16 }, () => ({ name: 'X', type: 'adult' }));
    expect(validateGuests(arr)).toBeNull();
  });
  it('accetta guest adulto senza age (age=null)', () => {
    expect(validateGuests([{ name: 'Mario', type: 'adult' }])).toEqual([
      { name: 'Mario', type: 'adult', age: null, intolerances: [] },
    ]);
  });
  it('accetta guest adulto con age esplicito null', () => {
    expect(validateGuests([{ name: 'Mario', type: 'adult', age: null }])).toEqual([
      { name: 'Mario', type: 'adult', age: null, intolerances: [] },
    ]);
  });

  it('rifiuta guest minor senza age (era il bug originale)', () => {
    expect(validateGuests([{ name: 'Piccolo', type: 'minor' }])).toBeNull();
    expect(validateGuests([{ name: 'Piccolo', type: 'minor', age: null }])).toBeNull();
    expect(validateGuests([{ name: 'Piccolo', type: 'minor', age: '' }])).toBeNull();
  });
  it('accetta minor con age valido 0-18', () => {
    expect(validateGuests([{ name: 'Neonato', type: 'minor', age: 0 }])).toEqual([
      { name: 'Neonato', type: 'minor', age: 0, intolerances: [] },
    ]);
    expect(validateGuests([{ name: 'Piccolo', type: 'minor', age: 7 }])).toEqual([
      { name: 'Piccolo', type: 'minor', age: 7, intolerances: [] },
    ]);
    expect(validateGuests([{ name: 'Ragazzo', type: 'minor', age: 18 }])).toEqual([
      { name: 'Ragazzo', type: 'minor', age: 18, intolerances: [] },
    ]);
  });
  it('rifiuta minor con age fuori range', () => {
    expect(validateGuests([{ name: 'X', type: 'minor', age: 19 }])).toBeNull();
    expect(validateGuests([{ name: 'X', type: 'minor', age: -1 }])).toBeNull();
    expect(validateGuests([{ name: 'X', type: 'minor', age: 25 }])).toBeNull();
  });
  it('rifiuta minor con age non numerico', () => {
    expect(validateGuests([{ name: 'X', type: 'minor', age: 'sette' }])).toBeNull();
    expect(validateGuests([{ name: 'X', type: 'minor', age: NaN }])).toBeNull();
  });
  it('tronca age decimali con Math.floor', () => {
    expect(validateGuests([{ name: 'X', type: 'minor', age: 7.9 }])).toEqual([
      { name: 'X', type: 'minor', age: 7, intolerances: [] },
    ]);
  });

  it('rifiuta type non valido', () => {
    expect(validateGuests([{ name: 'X', type: 'alien' }])).toBeNull();
    expect(validateGuests([{ name: 'X' }])).toBeNull();
  });
  it('rifiuta name vuoto o troppo lungo', () => {
    expect(validateGuests([{ name: '', type: 'adult' }])).toBeNull();
    expect(validateGuests([{ name: '   ', type: 'adult' }])).toBeNull();
    expect(validateGuests([{ name: 'x'.repeat(121), type: 'adult' }])).toBeNull();
  });
  it('trimma il nome', () => {
    expect(validateGuests([{ name: '  Mario  ', type: 'adult' }])).toEqual([
      { name: 'Mario', type: 'adult', age: null, intolerances: [] },
    ]);
  });

  it('passa le intolleranze del guest se valide', () => {
    expect(validateGuests([{ name: 'X', type: 'adult', intolerances: ['Lattosio', 'Glutine'] }])).toEqual([
      { name: 'X', type: 'adult', age: null, intolerances: ['Lattosio', 'Glutine'] },
    ]);
  });
  it('rifiuta guest se le sue intolleranze sono invalide', () => {
    expect(validateGuests([{ name: 'X', type: 'adult', intolerances: 'Lattosio' }])).toBeNull();
  });

  it('gestisce più guests misti', () => {
    const result = validateGuests([
      { name: 'A1', type: 'adult' },
      { name: 'M1', type: 'minor', age: 5 },
      { name: 'A2', type: 'adult', intolerances: [] },
    ]);
    expect(result).toEqual([
      { name: 'A1', type: 'adult', age: null, intolerances: [] },
      { name: 'M1', type: 'minor', age: 5, intolerances: [] },
      { name: 'A2', type: 'adult', age: null, intolerances: [] },
    ]);
  });

  it('rifiuta elemento null dentro l\'array', () => {
    expect(validateGuests([null, { name: 'X', type: 'adult' }])).toBeNull();
  });
  it('rifiuta elemento primitivo dentro l\'array', () => {
    expect(validateGuests(['stringa', { name: 'X', type: 'adult' }])).toBeNull();
  });
});
