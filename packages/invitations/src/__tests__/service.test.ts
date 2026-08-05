import { describe, expect, it } from 'vitest';
import { shouldRemind, dueForReminderToday, MAX_REMINDERS_BY_LEVEL } from '../service';
import { buildReminderEmailHtml, DEFAULT_SLOGAN } from '../email';
import { buildInvitedListWordHtml, buildInvitedListPdfHtml, buildInvitedListCsv } from '../export';
import type { InvitedGuest } from '../service';

const now = new Date('2026-08-20T10:00:00.000Z');

function guest(overrides: Partial<InvitedGuest> = {}): InvitedGuest {
  return {
    id: 'g1',
    event_id: 'e1',
    name: 'Mario Rossi',
    email: 'mario@example.com',
    whatsapp: '+393331234567',
    insist_level: 'medium',
    status: 'pending',
    last_reminder_at: null,
    reminder_count: 0,
    created_at: now.toISOString(),
    ...overrides,
  };
}

describe('shouldRemind', () => {
  it('true per pending senza solleciti', () => {
    expect(shouldRemind(guest(), now)).toBe(true);
  });

  it('false se status non è pending', () => {
    expect(shouldRemind(guest({ status: 'confirmed' }), now)).toBe(false);
    expect(shouldRemind(guest({ status: 'declined' }), now)).toBe(false);
  });

  it('rispetta il budget per livello (low=1, medium=2, high=3)', () => {
    expect(MAX_REMINDERS_BY_LEVEL.low).toBe(1);
    expect(MAX_REMINDERS_BY_LEVEL.medium).toBe(2);
    expect(MAX_REMINDERS_BY_LEVEL.high).toBe(3);
    expect(shouldRemind(guest({ insist_level: 'low', reminder_count: 1 }), now)).toBe(false);
    expect(shouldRemind(guest({ insist_level: 'medium', reminder_count: 1 }), now)).toBe(true);
    expect(shouldRemind(guest({ insist_level: 'medium', reminder_count: 2 }), now)).toBe(false);
    expect(shouldRemind(guest({ insist_level: 'high', reminder_count: 3 }), now)).toBe(false);
  });

  it('blocca se l\'ultimo sollecito è più recente di minDaysBetween', () => {
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
    expect(shouldRemind(guest({ last_reminder_at: twoDaysAgo }), now, 3)).toBe(false);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000).toISOString();
    expect(shouldRemind(guest({ last_reminder_at: fiveDaysAgo }), now, 3)).toBe(true);
  });
});

describe('dueForReminderToday', () => {
  it('esclude chi è già stato sollecitato oggi', () => {
    const today = '2026-08-20T08:00:00.000Z';
    const g = guest({ last_reminder_at: today });
    expect(dueForReminderToday([g], now)).toEqual([]);
  });

  it('include pending con budget libero non sollecitati oggi', () => {
    const a = guest({ id: 'a', reminder_count: 0 });
    const b = guest({ id: 'b', status: 'confirmed' });
    const c = guest({ id: 'c', insist_level: 'low', reminder_count: 1 });
    expect(dueForReminderToday([a, b, c], now).map((x) => x.id)).toEqual(['a']);
  });
});

describe('buildReminderEmailHtml', () => {
  const base = {
    brand: 'Sposi.live' as const,
    coupleName: 'Marco e Lucia',
    eventLink: 'https://www.sposi.live/event/abc',
    qrDataUri: 'data:image/png;base64,QUJD',
    logoDataUri: 'data:image/png;base64,TE9HTw==',
    rsvpDeadline: '2026-09-01',
  };

  it('saluta per nome e nomina la coppia', () => {
    const html = buildReminderEmailHtml('Giulia Bianchi', base);
    expect(html).toContain('Cari Giulia Bianchi');
    expect(html).toContain('Marco e Lucia');
  });

  it('include QR, link, slogan e logo', () => {
    const html = buildReminderEmailHtml('Giulia', base);
    expect(html).toContain('data:image/png;base64,QUJD');
    expect(html).toContain('https://www.sposi.live/event/abc');
    expect(html).toContain(DEFAULT_SLOGAN['Sposi.live']);
    expect(html).toContain('data:image/png;base64,TE9HTw==');
  });

  it('include il messaggio custom dello sposo se presente', () => {
    const html = buildReminderEmailHtml('Giulia', { ...base, message: 'Venite numerosi!' });
    expect(html).toContain('Venite numerosi!');
  });

  it('escape HTML nei dati utente', () => {
    const html = buildReminderEmailHtml('O\'Neil <b>x</b>', { ...base, message: 'a & b <c>' });
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('a &amp; b &lt;c&gt;');
  });

  it('slogan JustMarry in inglese', () => {
    const html = buildReminderEmailHtml('Lucy', { ...base, brand: 'JustMarry.live' });
    expect(html).toContain(DEFAULT_SLOGAN['JustMarry.live']);
  });
});

describe('export lista', () => {
  const guests = [
    guest({ id: 'a', name: 'Mario Rossi', status: 'pending', insist_level: 'high', reminder_count: 1 }),
    guest({ id: 'b', name: 'Anna Verdi', status: 'confirmed', email: 'anna@example.com', whatsapp: null }),
    guest({ id: 'c', name: 'Pino Solo Wa', status: 'pending', email: null }),
  ];
  const meta = {
    brand: 'Sposi.live' as const,
    coupleName: 'Marco e Lucia',
    generatedAt: '2026-08-20T10:00:00.000Z',
    logoDataUri: 'data:image/png;base64,TE9HTw==',
  };

  it('word: contiene intestazioni, nomi, conteggi e logo', () => {
    const html = buildInvitedListWordHtml(guests, meta);
    expect(html).toContain('Lista invitati');
    expect(html).toContain('Marco e Lucia');
    expect(html).toContain('Mario Rossi');
    expect(html).toContain('Anna Verdi');
    expect(html).toContain('3</strong> invitati');
    expect(html).toContain('data:image/png;base64,TE9HTw==');
  });

  it('word: marca whatsapp quando includeWhatsapp=true, altrimenti solo email', () => {
    expect(buildInvitedListWordHtml(guests, meta)).toContain('WhatsApp:');
    const without = buildInvitedListWordHtml(guests, { ...meta, includeWhatsapp: false });
    expect(without).not.toContain('WhatsApp:');
    expect(without).not.toContain('+393331234567');
  });

  it('pdf: contiene intestazioni, tabella e footer brand', () => {
    const html = buildInvitedListPdfHtml(guests, meta);
    expect(html).toContain('@page { size: A4');
    expect(html).toContain('Mario Rossi');
    expect(html).toContain('Generato con Sposi.live');
  });

  it('escape HTML nei nomi degli invitati', () => {
    const evil = guest({ id: 'x', name: '<script>alert(1)</script> & Co' });
    const html = buildInvitedListPdfHtml([evil], meta);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('csv: header, righe e BOM UTF-8', () => {
    const csv = buildInvitedListCsv(guests, true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('Nome;Email;WhatsApp;Insistenza;Stato;Solleciti inviati;Ultimo sollecito');
    expect(csv).toContain('Mario Rossi;mario@example.com;+393331234567;Insistere;Da confermare;1;');
    expect(csv).toContain('Anna Verdi;anna@example.com;;Medio;Confermato;0;');
  });

  it('csv: escape dei valori con separatore o virgolette', () => {
    const tricky = guest({ id: 't', name: 'Rossi; Mario "il Rosso"' });
    const csv = buildInvitedListCsv([tricky], true);
    expect(csv).toContain('"Rossi; Mario ""il Rosso"""');
  });
});
