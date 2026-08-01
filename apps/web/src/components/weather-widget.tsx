'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  shouldShowWeather,
  weatherCodeToInfo,
  type WeatherForecast,
} from '@fotosposi/weather';

interface WeatherWidgetProps {
  /** Nome città (dalla creazione evento: location / church_city / venue_city). */
  city?: string;
  /** Data evento YYYY-MM-DD. */
  eventDate?: string;
}

/**
 * Widget meteo automatico per il giorno dell'evento.
 *
 * Appare SOLO da 3 giorni prima dell'evento (gate client con
 * `shouldShowWeather`), poi mostra il meteo del giorno esatto della cerimonia
 * via `/api/weather` → Open-Meteo. Nessun input extra per gli sposi: la città
 * è quella già inserita nella creazione evento.
 */
export default function WeatherWidget({ city, eventDate }: WeatherWidgetProps) {
  const t = useTranslations('weather');
  const [visible, setVisible] = useState(false);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Gate temporale: mostra solo nella finestra [evento-3gg, evento+1gg].
  useEffect(() => {
    if (!eventDate) {
      setVisible(false);
      setLoading(false);
      return;
    }
    setVisible(shouldShowWeather(eventDate));
  }, [eventDate]);

  useEffect(() => {
    if (!visible || !city || !eventDate) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/weather?city=${encodeURIComponent(city)}&date=${encodeURIComponent(eventDate)}`)
      .then((r) => {
        if (!r.ok) throw new Error('not ok');
        return r.json();
      })
      .then((data: WeatherForecast) => {
        if (!cancelled) {
          setForecast(data);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, city, eventDate]);

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-text-muted animate-pulse">
        <span>🌡️</span>
        <span>{t('loading')}</span>
      </div>
    );
  }

  if (error || !forecast) {
    return (
      <div className="text-xs text-text-muted flex items-center gap-1.5">
        <span>{t('unavailable')}</span>
      </div>
    );
  }

  const info = weatherCodeToInfo(forecast.code);

  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-border bg-surface/80 px-4 py-2.5 shadow-sm">
      <span className="text-2xl" aria-hidden>
        {info.emoji}
      </span>
      <div className="text-left">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {t('title')} · {forecast.city}
        </p>
        <p className="text-sm font-semibold">
          {t(info.labelKey)}
          <span className="text-text-muted font-normal"> · {Math.round(forecast.tMax)}°C</span>
          <span className="text-text-muted font-normal"> / {Math.round(forecast.tMin)}°C</span>
          {forecast.rainProb > 0 && (
            <span className="text-text-muted font-normal"> · {t('rain')} {forecast.rainProb}%</span>
          )}
        </p>
      </div>
    </div>
  );
}
