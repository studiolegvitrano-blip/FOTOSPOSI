import { NextRequest, NextResponse } from 'next/server';
import { repairWatermarkForEvent } from '@/lib/process-queue';

// Route admin one-shot: ri-applica il watermark a tutte le foto di un evento
// marcate `watermark_missing = true` (foto processate prima del fix 28/07/2026
// o dove applyOverlay è caduto silenziosamente). NON è un cron — l'utente
// deve invocarlo esplicitamente quando vuole riparare un evento.
//
// Auth: servizio-level `CRON_SECRET` (vedi api/cron/*). Stesso modello delle
// altre route admin-one-shot. Per richiama via dashboard sposi futura:
//   POST /api/r2/repair-watermark  body: { eventId: "..." }  header: X-Cron-Secret: <CRON_SECRET>
//
// Il watermark video ri-codifica con ffmpeg: max 300s per lambda.
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { eventId, limit } = await request.json();
    if (!eventId) return NextResponse.json({ error: 'eventId richiesto' }, { status: 400 });
    const result = await repairWatermarkForEvent(eventId, typeof limit === 'number' ? limit : 50);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
