import { NextRequest, NextResponse } from 'next/server';
import { fetchWeatherForEvent, shouldShowWeather } from '@fotosposi/weather';

/**
 * GET /api/weather?city=Palermo&date=2026-08-30
 *
 * Ritorna il meteo del giorno ESATTO dell'evento via Open-Meteo
 * (gratis, senza API key). Il sistema usa la città già inserita dallo sposo
 * nella creazione evento — nessun input extra.
 *
 * Il widget appare solo da 3 giorni prima dell'evento (gate lato client nel
 * componente WeatherWidget), ma anche qui rifiutiamo richieste fuori finestra
 * per non chiamare Open-Meteo inutilmente settimane prima.
 *
 * Cache: s-maxage 1h (il forecast non cambia ogni secondo).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city') || '';
  const date = searchParams.get('date') || '';

  if (!city) {
    return NextResponse.json({ error: 'Parametro city mancante' }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Parametro date non valido (atteso YYYY-MM-DD)' }, { status: 400 });
  }

  // Gate finestra: il widget non deve comparire prima di 3 giorni dall'evento.
  if (!shouldShowWeather(date)) {
    return NextResponse.json({ error: 'Meteo non ancora disponibile' }, { status: 404 });
  }

  try {
    const forecast = await fetchWeatherForEvent(city, date);
    return NextResponse.json(forecast, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=3600',
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Errore interno';
    // Città non trovata / dati incompleti → 404 senza stack.
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
