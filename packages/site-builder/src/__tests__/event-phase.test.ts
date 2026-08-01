import { describe, it, expect } from 'vitest';
import { getEventPhase } from '../index';

const NOW = new Date('2026-08-15T10:00:00');

describe('getEventPhase', () => {
  it('phase=countdown quando now è molto prima della cerimonia', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      ceremonyTime: '11:00',
      receptionTime: '13:00',
      now: new Date('2026-08-14T08:00:00'),
    });
    expect(phase).toBe('countdown');
  });

  it('phase=ceremony quando now è tra ceremonyStart e receptionStart', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      ceremonyTime: '11:00',
      receptionTime: '13:00',
      now: new Date('2026-08-15T11:30:00'),
    });
    expect(phase).toBe('ceremony');
  });

  it('phase=reception quando now è >= receptionStart e < dayAfter', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      ceremonyTime: '11:00',
      receptionTime: '13:00',
      now: new Date('2026-08-15T13:00:00'),
    });
    expect(phase).toBe('reception');
  });

  it('phase=reception anche molto più tardi nella stessa giornata', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      ceremonyTime: '11:00',
      receptionTime: '13:00',
      now: new Date('2026-08-15T23:30:00'),
    });
    expect(phase).toBe('reception');
  });

  it('phase=ended quando now è >= dayAfter', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      ceremonyTime: '11:00',
      receptionTime: '13:00',
      now: new Date('2026-08-16T11:01:00'),
    });
    expect(phase).toBe('ended');
  });

  it('usa fallback 11:00/13:00 quando ceremonyTime e receptionTime non specificati', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      now: new Date('2026-08-15T12:00:00'),
    });
    expect(phase).toBe('ceremony');
  });

  it('rispetta `time` legacy come ceremonyTime se ceremonyTime non specificato', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      time: '15:00',
      receptionTime: '18:00',
      now: new Date('2026-08-15T15:30:00'),
    });
    expect(phase).toBe('ceremony');
  });

  it('impact-of-ceremonyWindow-2h: ora subito prima della fine finestra resta ceremony', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      ceremonyTime: '10:30',
      receptionTime: '13:00',
      now: new Date('2026-08-15T12:29:00'),
    });
    expect(phase).toBe('ceremony');
  });

  it('gap theory: ceremonyEnd < now < receptionStart → ceremony (benvenuto)', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      ceremonyTime: '10:00',
      receptionTime: '14:00',
      now: new Date('2026-08-15T13:00:00'),
    });
    expect(phase).toBe('ceremony');
  });

  it('phase=countdown when now is just before ceremonyStart (1ms before)', () => {
    const phase = getEventPhase({
      date: '2026-08-15',
      ceremonyTime: '11:00',
      receptionTime: '13:00',
      now: new Date('2026-08-15T10:59:59.999'),
    });
    expect(phase).toBe('countdown');
  });

  it('ritorna countdown per date invalide o mancanti', () => {
    expect(getEventPhase({ date: '', now: NOW })).toBe('countdown');
    expect(getEventPhase({ date: 'invalid', now: NOW })).toBe('countdown');
    expect(getEventPhase({ date: '2026-13-99', now: NOW })).toBe('countdown');
  });

  it('uses Date.now() as fallback when now not passed', () => {
    const phaseFuture = getEventPhase({
      date: '2999-01-01',
      ceremonyTime: '11:00',
    });
    expect(['countdown', 'ceremony', 'reception', 'ended']).toContain(phaseFuture);
    expect(phaseFuture).toBe('countdown');
  });

  it('phase=ended on past events (years ago)', () => {
    const phase = getEventPhase({
      date: '2020-01-01',
      ceremonyTime: '11:00',
      receptionTime: '13:00',
      now: new Date('2021-01-01'),
    });
    expect(phase).toBe('ended');
  });
});
