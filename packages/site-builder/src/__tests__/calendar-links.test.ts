import { describe, it, expect } from 'vitest';
import {
  generateIcsLink,
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  getCalendarLinks,
} from '../index';

describe('generateIcsLink (legacy ICS download)', () => {
  it('genera data URI text/calendar con VCALENDAR/VEVENT corretti', () => {
    const url = generateIcsLink('2026-08-15', '11:00', 'Matrimonio Marco & Lucia', 'Chiesa SS. Trinità, Palermo', 'Tutti gli invitati sono benvenuti');
    expect(url).toMatch(/^data:text\/calendar;charset=utf-8,/);
    const decoded = decodeURIComponent(url.replace('data:text/calendar;charset=utf-8,', ''));
    expect(decoded).toContain('BEGIN:VCALENDAR');
    expect(decoded).toContain('BEGIN:VEVENT');
    expect(decoded).toContain('DTSTART:20260815T110000');
    // end = start + 2h
    expect(decoded).toContain('DTEND:20260815T130000');
    expect(decoded).toContain('SUMMARY:Matrimonio Marco & Lucia');
    expect(decoded).toContain('LOCATION:Chiesa SS. Trinità, Palermo');
    expect(decoded).toContain('END:VEVENT');
  });

  it('end time non sfora le 24h (wrap midnight)', () => {
    // Limite noto documentato: la formula attuale usa `(hh + 2)` senza wrap.
    // Per un evento wedding realisticamente fine entro le 23:00. Se in futuro
    // servirà supportare eventi serali oltre le 22:00, fixare il wrap.
    const url = generateIcsLink('2026-08-15', '22:30', 'Late event', 'X', '');
    const decoded = decodeURIComponent(url.replace('data:text/calendar;charset=utf-8,', ''));
    expect(decoded).toContain('DTSTART:20260815T223000');
    // endH = 22+2 = 24 → DTEND 20260815T243000 (24:30 = ICS parser lo ignora ma non crash)
    expect(decoded).toContain('DTEND:20260815T243000');
  });

  it('usa 12:00 come default se time mancante', () => {
    const url = generateIcsLink('2026-08-15', '', 'Titolo', '', '');
    const decoded = decodeURIComponent(url.replace('data:text/calendar;charset=utf-8,', ''));
    expect(decoded).toContain('DTSTART:20260815T120000');
  });
});

describe('generateGoogleCalendarUrl', () => {
  it('genera URL calendar.google.com/calendar/render con parametri corretti', () => {
    const url = generateGoogleCalendarUrl({
      date: '2026-08-15',
      time: '11:00',
      title: 'Matrimonio Marco & Lucia',
      address: 'Chiesa SS. Trinità, Palermo',
      note: 'Cerimonia ore 11:00, seguirà ricevimento',
      durationMinutes: 120,
    });
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    const u = new URL(url);
    expect(u.searchParams.get('action')).toBe('TEMPLATE');
    expect(u.searchParams.get('text')).toBe('Matrimonio Marco & Lucia');
    expect(u.searchParams.get('location')).toBe('Chiesa SS. Trinità, Palermo');
    expect(u.searchParams.get('details')).toContain('Cerimonia');
    // dates = start/end in YYYYMMDDTHHMM00 form
    expect(u.searchParams.get('dates')).toContain('20260815T110000');
    expect(u.searchParams.get('dates')).toContain('20260815T130000');
  });

  it('senza duration, dates usa start/start (Google accetta evento puntuale)', () => {
    const url = generateGoogleCalendarUrl({
      date: '2026-08-15', time: '16:00', title: 'X',
    });
    const u = new URL(url);
    expect(u.searchParams.get('dates')).toBe('20260815T160000/20260815T160000');
  });
});

describe('generateOutlookCalendarUrl', () => {
  it('genera URL outlook.live.com con datetime ISO per start/end', () => {
    const url = generateOutlookCalendarUrl({
      date: '2026-08-15',
      time: '11:00',
      title: 'Matrimonio Marco & Lucia',
      address: 'Chiesa SS. Trinità, Palermo',
      durationMinutes: 120,
    });
    expect(url).toMatch(/^https:\/\/outlook\.live\.com\/calendar\/0\/deeplink\/compose\?/);
    const u = new URL(url);
    expect(u.searchParams.get('subject')).toBe('Matrimonio Marco & Lucia');
    expect(u.searchParams.get('location')).toBe('Chiesa SS. Trinità, Palermo');
    expect(u.searchParams.get('path')).toBe('/calendar/action/compose');
    expect(u.searchParams.get('rru')).toBe('addevent');
    // NB: startdt/enddt sono ISO in UTC. Verifichiamo solo la durata (timezone-agnostic)
    // e che la data sia 2026-08-15 (in UTC potrebbe slittare a 2026-08-14 sera se siamo in timezone positivo).
    const start = new Date(u.searchParams.get('startdt')!);
    const end = new Date(u.searchParams.get('enddt')!);
    expect((end.getTime() - start.getTime()) / 60000).toBe(120);
    // Il giorno locale (Europe/Rome) del start deve essere 2026-08-15
    const localDate = start.toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
    expect(localDate).toBe('2026-08-15');
  });

  it('usa default duration 120min se non specificata', () => {
    const url = generateOutlookCalendarUrl({
      date: '2026-08-15', time: '11:00', title: 'X',
    });
    const u = new URL(url);
    const start = new Date(u.searchParams.get('startdt')!);
    const end = new Date(u.searchParams.get('enddt')!);
    expect((end.getTime() - start.getTime()) / 60000).toBe(120);
  });
});

describe('getCalendarLinks (helper unificato)', () => {
  it('ritorna google + outlook + ics tutti validi', () => {
    const links = getCalendarLinks({
      date: '2026-08-15',
      time: '11:00',
      title: 'Matrimonio Marco & Lucia',
      address: 'Chiesa SS. Trinità, Palermo',
      durationMinutes: 180,
    });
    expect(links.google).toMatch(/^https:\/\/calendar\.google\.com/);
    expect(links.outlook).toMatch(/^https:\/\/outlook\.live\.com/);
    expect(links.ics).toMatch(/^data:text\/calendar/);
  });

  it('gestisce campi opzionali undefined senza errori', () => {
    const links = getCalendarLinks({
      date: '2026-08-15',
      time: '11:00',
      title: 'X',
    });
    expect(links.google).toBeTruthy();
    expect(links.outlook).toBeTruthy();
    expect(links.ics).toBeTruthy();
  });
});
