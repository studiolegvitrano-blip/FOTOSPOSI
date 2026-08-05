import { describe, it, expect } from 'vitest';
import { buildRsvpSummaryPdfHtml } from '../rsvp';
import type { RsvpSummaryEntry } from '../rsvp';

const entries: RsvpSummaryEntry[] = [
  {
    id: 'a',
    host_name: 'Mario Rossi',
    host_intolerances: ['Glutine'],
    guests: [
      { name: 'Luca Rossi', type: 'minor', age: 7, intolerances: [] },
      { name: 'Anna Bianchi', type: 'adult', age: null, intolerances: ['Lattosio'] },
    ],
    message: 'Non vediamo l\'ora!',
    created_at: '2026-08-05T10:00:00Z',
  },
  {
    id: 'b',
    host_name: 'Giulia Verdi',
    host_intolerances: [],
    guests: [],
    message: null,
    created_at: '2026-08-06T10:00:00Z',
  },
];

const numbers = { totalResponses: 2, totalPeople: 4, totalAdults: 2, totalMinors: 1, topIntolerances: [{ name: 'Glutine', count: 1 }] };

describe('buildRsvpSummaryPdfHtml', () => {
  it('è una lettera "Cari Sposi" con i numeri adulti/bambini', () => {
    const html = buildRsvpSummaryPdfHtml(entries, { brand: 'Sposi.live', coupleName: 'Marco & Anna', generatedAt: '2026-08-05T00:00:00Z', logoDataUri: null }, numbers);
    expect(html).toContain('Cari Sposi');
    expect(html).toContain('ad oggi le risposte ai vostri inviti sono');
    expect(html).toContain('>2<');          // conferme
    expect(html).toContain('>4<');          // persone totali
    expect(html).toContain('>2<');          // adulti
    expect(html).toContain('>1<');          // bambini
    expect(html).toContain('2 adulti');
    expect(html).toContain('1 bambino');
  });

  it('elenca intolleranze con chi', () => {
    const html = buildRsvpSummaryPdfHtml(entries, { brand: 'Sposi.live', coupleName: '', generatedAt: '', logoDataUri: null }, numbers);
    expect(html).toContain('Mario Rossi');
    expect(html).toContain('— Glutine');
    expect(html).toContain('Mario Rossi (Anna Bianchi)');
    expect(html).toContain('— Lattosio');
  });

  it('mostra il dettaglio per famiglia con accompagnatori e età minori', () => {
    const html = buildRsvpSummaryPdfHtml(entries, { brand: 'Sposi.live', coupleName: '', generatedAt: '', logoDataUri: null }, numbers);
    expect(html).toContain('Luca Rossi');
    expect(html).toContain('bambino (7 anni)');
    expect(html).toContain('Anna Bianchi');
    expect(html).toContain('adulto');
    expect(html).toContain('Non vediamo');
  });

  it('chiude con "Grazie di aver scelto" + brand corretto', () => {
    const html = buildRsvpSummaryPdfHtml(entries, { brand: 'Sposi.live', coupleName: '', generatedAt: '', logoDataUri: null }, numbers);
    expect(html).toContain('Grazie di aver scelto Sposi.live');
  });

  it('usa JustMarry.live come brand e grazie per brand weddingmoments', () => {
    const html = buildRsvpSummaryPdfHtml(entries, { brand: 'JustMarry.live', coupleName: '', generatedAt: '', logoDataUri: null }, numbers);
    expect(html).toContain('Grazie di aver scelto JustMarry.live');
  });

  it('embedda il logo come data URI quando fornito', () => {
    const html = buildRsvpSummaryPdfHtml(entries, { brand: 'Sposi.live', coupleName: '', generatedAt: '', logoDataUri: 'data:image/png;base64,XXXX' }, numbers);
    expect(html).toContain('data:image/png;base64,XXXX');
  });

  it('gestisce lista vuota senza errori', () => {
    const empty = { totalResponses: 0, totalPeople: 0, totalAdults: 0, totalMinors: 0, topIntolerances: [] };
    const html = buildRsvpSummaryPdfHtml([], { brand: 'Sposi.live', coupleName: '', generatedAt: '', logoDataUri: null }, empty);
    expect(html).toContain('Nessuna conferma ricevuta');
  });

  it('escape i nomi con caratteri HTML', () => {
    const evil: RsvpSummaryEntry[] = [{
      id: 'x',
      host_name: 'Famiglia <A&B>',
      host_intolerances: [],
      guests: [],
      message: null,
      created_at: '2026-08-05T10:00:00Z',
    }];
    const nums = { totalResponses: 1, totalPeople: 1, totalAdults: 1, totalMinors: 0, topIntolerances: [] };
    const html = buildRsvpSummaryPdfHtml(evil, { brand: 'Sposi.live', coupleName: '', generatedAt: '', logoDataUri: null }, nums);
    expect(html).toContain('Famiglia &lt;A&amp;B&gt;');
    expect(html).not.toContain('Famiglia <A&B>');
  });
});
