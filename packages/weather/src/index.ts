/**
 * @fotosposi/weather — widget meteo automatico per il giorno dell'evento.
 *
 * Provider: Open-Meteo (gratuito, senza API key, con geocoding incluso).
 * Il sistema usa SOLO la città che lo sposo ha già inserito nella creazione
 * evento (`location` / `church_city` / `venue_city`): nessun input extra.
 *
 * Flusso:
 *   1. `shouldShowWeather()` — il widget appare solo da 3 giorni prima dell'evento
 *      (decisione utente 01/08/2026: niente meteo settimane prima, è inutile).
 *   2. `fetchWeatherForEvent()` — geocoding città → lat/lon → forecast Open-Meteo
 *      per il giorno ESATTO della cerimonia (start_date=end_date=eventDate).
 */

export interface WeatherForecast {
  /** Nome località risolto dal geocoding (es. "Palermo"). */
  city: string;
  /** Data evento YYYY-MM-DD. */
  date: string;
  /** WMO weather code del giorno evento (0-99). */
  code: number;
  /** Temperatura max °C. */
  tMax: number;
  /** Temperatura min °C. */
  tMin: number;
  /** Probabilità precipitazioni % (0-100). */
  rainProb: number;
}

export interface WeatherInfo {
  /** Chiave i18n per la label (es. "sunny", "rain"). */
  labelKey: string;
  /** Emoji descrittiva per il widget. */
  emoji: string;
}

/** Giorni prima dell'evento in cui il widget meteo inizia a comparire. */
export const WEATHER_DAYS_BEFORE = 3;

/** Giorni dopo l'evento in cui il widget resta visibile (il giorno dopo, per il "wake-up" degli invitati). */
export const WEATHER_DAYS_AFTER = 1;

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/**
 * Determina se il widget meteo deve essere mostrato oggi.
 *
 * Finestra: `[eventDate - WEATHER_DAYS_BEFORE, eventDate + WEATHER_DAYS_AFTER]`.
 * Prima di 3 giorni è inutile (forecast non affidabile), dopo il giorno dopo
 * il matrimonio non serve più.
 *
 * @param eventDate data evento YYYY-MM-DD
 * @param now istante corrente (iniettabile per i test)
 */
export function shouldShowWeather(eventDate: string, now: Date = new Date()): boolean {
  if (!eventDate) return false;
  const target = new Date(eventDate + 'T12:00:00');
  if (Number.isNaN(target.getTime())) return false;

  const start = new Date(target);
  start.setDate(start.getDate() - WEATHER_DAYS_BEFORE);
  start.setHours(0, 0, 0, 0);

  const end = new Date(target);
  end.setDate(end.getDate() + WEATHER_DAYS_AFTER);
  end.setHours(23, 59, 59, 999);

  return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
}

/**
 * Mappa un WMO weather code (Open-Meteo) a label i18n + emoji.
 * Docs: https://open-meteo.com/en/docs#weathervariables
 */
export function weatherCodeToInfo(code: number): WeatherInfo {
  switch (code) {
    case 0:
      return { labelKey: 'sunny', emoji: '☀️' };
    case 1:
      return { labelKey: 'mostly_sunny', emoji: '🌤️' };
    case 2:
      return { labelKey: 'partly_cloudy', emoji: '⛅' };
    case 3:
      return { labelKey: 'cloudy', emoji: '☁️' };
    case 45:
    case 48:
      return { labelKey: 'fog', emoji: '🌫️' };
    case 51:
    case 53:
    case 55:
      return { labelKey: 'drizzle', emoji: '🌦️' };
    case 56:
    case 57:
      return { labelKey: 'freezing_drizzle', emoji: '🌧️' };
    case 61:
      return { labelKey: 'light_rain', emoji: '🌧️' };
    case 63:
      return { labelKey: 'rain', emoji: '🌧️' };
    case 65:
      return { labelKey: 'heavy_rain', emoji: '🌧️' };
    case 66:
    case 67:
      return { labelKey: 'freezing_rain', emoji: '🌧️' };
    case 71:
      return { labelKey: 'light_snow', emoji: '🌨️' };
    case 73:
      return { labelKey: 'snow', emoji: '❄️' };
    case 75:
      return { labelKey: 'heavy_snow', emoji: '❄️' };
    case 77:
      return { labelKey: 'snow_grains', emoji: '❄️' };
    case 80:
    case 81:
    case 82:
      return { labelKey: 'showers', emoji: '🌧️' };
    case 85:
    case 86:
      return { labelKey: 'snow_showers', emoji: '🌨️' };
    case 95:
      return { labelKey: 'thunderstorm', emoji: '⛈️' };
    case 96:
    case 99:
      return { labelKey: 'hail', emoji: '⛈️' };
    default:
      return { labelKey: 'unknown', emoji: '🌡️' };
  }
}

interface GeoResult {
  name?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Costruisce gli URL Open-Meteo (geocoding + forecast) per una città e una data.
 * Esposto per testabilità; il fetcher usa questi URL.
 */
export function buildOpenMeteoUrls(city: string, date: string): { geocoding: string; forecast: (lat: number, lon: number) => string } {
  const q = encodeURIComponent(city.trim());
  return {
    geocoding: `${GEOCODING_URL}?name=${q}&count=1&language=it&format=json`,
    forecast: (lat: number, lon: number) =>
      `${FORECAST_URL}?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${date}&end_date=${date}`,
  };
}

interface ForecastDaily {
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: number[];
}

interface ForecastResponse {
  daily?: ForecastDaily;
  error?: boolean;
  reason?: string;
}

interface GeoResponse {
  results?: GeoResult[];
}

/**
 * Fetch del meteo per il giorno evento via Open-Meteo.
 *
 * @param city nome città (già inserita dallo sposo nella creazione evento)
 * @param eventDate data evento YYYY-MM-DD
 * @param fetchFn iniettabile per i test (default: global fetch)
 * @throws Error se geocoding o forecast falliscono o la città non è trovata
 */
export async function fetchWeatherForEvent(
  city: string,
  eventDate: string,
  fetchFn: typeof fetch = fetch,
): Promise<WeatherForecast> {
  const clean = (city || '').trim();
  if (!clean) throw new Error('Città non specificata');
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new Error('Data evento non valida');
  }

  const { geocoding, forecast } = buildOpenMeteoUrls(clean, eventDate);

  const geoRes = await fetchFn(geocoding);
  if (!geoRes.ok) throw new Error(`Geocoding fallito (HTTP ${geoRes.status})`);
  const geo: GeoResponse = await geoRes.json();
  const first = geo.results?.[0];
  if (!first || first.latitude == null || first.longitude == null) {
    throw new Error(`Città non trovata: ${clean}`);
  }

  const fcRes = await fetchFn(forecast(first.latitude, first.longitude));
  if (!fcRes.ok) throw new Error(`Forecast fallito (HTTP ${fcRes.status})`);
  const fc: ForecastResponse = await fcRes.json();
  if (fc.error) throw new Error(fc.reason || 'Forecast errore');

  const code = fc.daily?.weather_code?.[0];
  const tMax = fc.daily?.temperature_2m_max?.[0];
  const tMin = fc.daily?.temperature_2m_min?.[0];
  const rainProb = fc.daily?.precipitation_probability_max?.[0];
  if (code == null || tMax == null || tMin == null) {
    throw new Error('Dati forecast incompleti');
  }

  return {
    city: first.name || clean,
    date: eventDate,
    code,
    tMax,
    tMin,
    rainProb: rainProb ?? 0,
  };
}
