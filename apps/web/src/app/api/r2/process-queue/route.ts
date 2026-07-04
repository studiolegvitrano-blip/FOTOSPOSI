import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@fotosposi/core';
import { processQueueForEvent } from '@/lib/process-queue';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rl = rateLimit(`process-queue:${ip}`, 30, 60000);
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
