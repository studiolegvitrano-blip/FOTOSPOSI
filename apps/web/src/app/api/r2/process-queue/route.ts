import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { rateLimit, createServerSideClient } from '@fotosposi/core';
import { processQueueForEvent } from '@/lib/process-queue';

// Il watermark video ri-codifica il clip con ffmpeg: serve il runtime Node e più
// tempo del default. 300s è il massimo consentito con Fluid Compute.
export const runtime = 'nodejs';
export const maxDuration = 300;

// Rate-limit GUARDIA: protegge da un attaccante che spamma richieste senza auth.
// Key = userId autenticato, con finestra generosa perché l'elaborazione video è CPU-bound
// (limitiamo le CHIAMATE esterne, non l'elaborazione interna). 60 chiamate/min per utente
// = un utente può triggerare processing ogni secondo; sopra serve autenticarsi diversamente.
// In dev/test localhost tutti gli agent girano dallo stesso IP → usare IP come fallback
// quando non autenticati satura falsi positivi (vedi stress test 26/07/2026).
export async function POST(request: NextRequest) {
  let userIdForRate: string | null = null;
  try {
    const cookieStore = await cookies();
    const authClient = createServerSideClient(() => cookieStore.getAll());
    const { data: { user } } = await authClient.auth.getUser();
    if (user) userIdForRate = user.id;
  } catch { /* anonimo OK per il fallback */ }

  const rateKey = userIdForRate
    ? `process-queue:user:${userIdForRate}`
    : `process-queue:ip:${request.headers.get('x-forwarded-for') || 'unknown'}`;
  const rl = rateLimit(rateKey, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Troppe richieste' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  try {
    const { eventId } = await request.json();
    if (!eventId) return NextResponse.json({ error: 'eventId richiesto' }, { status: 400 });

    const { processed, remaining } = await processQueueForEvent(eventId, 5);
    return NextResponse.json({ done: remaining === 0, processed, remaining });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
