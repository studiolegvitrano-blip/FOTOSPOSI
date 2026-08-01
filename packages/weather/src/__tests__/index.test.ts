import { describe, it, expect } from 'vitest';
import {
  WEATHER_DAYS_AFTER,
  WEATHER_DAYS_BEFORE,
  shouldShowWeather,
  weatherCodeToInfo,
  buildOpenMeteoUrls,
  fetchWeatherForEvent,
} from '../index';

describe('shouldShowWeather', () => {
  it('mostra il widget da 3 giorni prima dell\'evento', () => {
    const eventDate = '2026-08-30';
    const now = new Date('2026-08-27T10:00:00');
    expect(shouldShowWeather(eventDate, now)).toBe(true);
  });

  it('non mostra il widget oltre 3 giorni prima', () => {
    const eventDate = '2026-08-30';
    const now = new Date('2026-08-26T23:59:59');
    expect(shouldShowWeather(eventDate, now)).toBe(false);
  });

  it('mostra il widget il giorno dell\'evento', () => {
    const eventDate = '2026-08-30';
    const now = new Date('2026-08-30T08:00:00');
    expect(shouldShowWeather(eventDate, now)).toBe(true);
  });

  it('mostra il widget il giorno dopo l\'evento (wake-up invitati)', () => {
    const eventDate = '2026-08-30';
    const now = new Date('2026-08-31T12:00:00');
    expect(shouldShowWeather(eventDate, now)).toBe(true);
  });

  it('non mostra il widget due giorni dopo l\'evento', () => {
    const eventDate = '2026-08-30';
    const now = new Date('2026-09-01T00:00:00');
    expect(shouldShowWeather(eventDate, now)).toBe(false);
  });

  it('data evento vuota → false', () => {
    expect(shouldShowWeather('', new Date('2026-08-30'))).toBe(false);
  });

  it('data evento non valida → false', () => {
    expect(shouldShowWeather('non-una-data', new Date('2026-08-30'))).toBe(false);
  });

  it('rispetta le costanti WEATHER_DAYS_BEFORE/AFTER', () => {
    expect(WEATHER_DAYS_BEFORE).toBe(3);
    expect(WEATHER_DAYS_AFTER).toBe(1);
  });
});

describe('weatherCodeToInfo', () => {
  it('mapta i codici principali a label/emoji', () => {
    expect(weatherCodeToInfo(0)).toEqual({ labelKey: 'sunny', emoji: '☀️' });
    expect(weatherCodeToInfo(3)).toEqual({ labelKey: 'cloudy', emoji: '☁️' });
    expect(weatherCodeToInfo(63)).toEqual({ labelKey: 'rain', emoji: '🌧️' });
    expect(weatherCodeToInfo(95)).toEqual({ labelKey: 'thunderstorm', emoji: '⛈️' });
  });

  it('codice sconosciuto → fallback unknown', () => {
    expect(weatherCodeToInfo(999)).toEqual({ labelKey: 'unknown', emoji: '🌡️' });
  });
});

describe('buildOpenMeteoUrls', () => {
  it('costruisce URL geocoding con città encodeURIComponent', () => {
    const { geocoding } = buildOpenMeteoUrls('Palermo, PA', '2026-08-30');
    expect(geocoding).toContain('geocoding-api.open-meteo.com/v1/search');
    expect(geocoding).toContain('name=Palermo%2C%20PA');
    expect(geocoding).toContain('language=it');
  });

  it('costruisce URL forecast con date start=end=eventDate', () => {
    const { forecast } = buildOpenMeteoUrls('Palermo', '2026-08-30');
    const url = forecast(38.1, 13.36);
    expect(url).toContain('api.open-meteo.com/v1/forecast');
    expect(url).toContain('latitude=38.1');
    expect(url).toContain('longitude=13.36');
    expect(url).toContain('start_date=2026-08-30');
    expect(url).toContain('end_date=2026-08-30');
    expect(url).toContain('weather_code');
  });
});

describe('fetchWeatherForEvent', () => {
  const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

  it('geocodifica e ritorna il forecast per il giorno evento', async () => {
    const calls: string[] = [];
    const fetchFn = async (url: string): Promise<Response> => {
      calls.push(url);
      if (url.includes('/search')) {
        return okJson({ results: [{ name: 'Palermo', latitude: 38.1, longitude: 13.36 }] });
      }
      return okJson({
        daily: {
          weather_code: [61],
          temperature_2m_max: [29.4],
          temperature_2m_min: [21.2],
          precipitation_probability_max: [55],
        },
      });
    };

    const result = await fetchWeatherForEvent('Palermo', '2026-08-30', fetchFn as typeof fetch);
    expect(calls.length).toBe(2);
    expect(result).toEqual({
      city: 'Palermo',
      date: '2026-08-30',
      code: 61,
      tMax: 29.4,
      tMin: 21.2,
      rainProb: 55,
    });
  });

  it('città non trovata → throw', async () => {
    const fetchFn = async (url: string): Promise<Response> => {
      if (url.includes('/search')) return okJson({ results: [] });
      throw new Error('non raggiungibile');
    };
    await expect(fetchWeatherForEvent('Città Inesistente', '2026-08-30', fetchFn as typeof fetch)).rejects.toThrow(
      'Città non trovata',
    );
  });

  it('città vuota → throw', async () => {
    await expect(fetchWeatherForEvent('', '2026-08-30')).rejects.toThrow('Città non specificata');
  });

  it('data evento non valida → throw', async () => {
    await expect(fetchWeatherForEvent('Palermo', '30/08/2026')).rejects.toThrow('Data evento non valida');
  });

  it('geocoding HTTP error → throw', async () => {
    const fetchFn = async (url: string): Promise<Response> => {
      if (url.includes('/search')) return { ok: false, status: 500 } as Response;
      throw new Error('non raggiungibile');
    };
    await expect(fetchWeatherForEvent('Palermo', '2026-08-30', fetchFn as typeof fetch)).rejects.toThrow(
      'Geocoding fallito',
    );
  });

  it('forecast error body → throw', async () => {
    const fetchFn = async (url: string): Promise<Response> => {
      if (url.includes('/search')) {
        return okJson({ results: [{ name: 'Palermo', latitude: 38.1, longitude: 13.36 }] });
      }
      return okJson({ error: true, reason: 'Rate limited' });
    };
    await expect(fetchWeatherForEvent('Palermo', '2026-08-30', fetchFn as typeof fetch)).rejects.toThrow('Rate limited');
  });

  it('dati forecast incompleti → throw', async () => {
    const fetchFn = async (url: string): Promise<Response> => {
      if (url.includes('/search')) {
        return okJson({ results: [{ name: 'Palermo', latitude: 38.1, longitude: 13.36 }] });
      }
      return okJson({ daily: { weather_code: [0] } });
    };
    await expect(fetchWeatherForEvent('Palermo', '2026-08-30', fetchFn as typeof fetch)).rejects.toThrow(
      'Dati forecast incompleti',
    );
  });
});
