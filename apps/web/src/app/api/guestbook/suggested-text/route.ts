import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, generateText } from '@fotosposi/core';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  const guestName = searchParams.get('guestName') || 'amico';

  if (!eventId) {
    return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: event } = await supabase
    .from('events')
    .select('couple_name')
    .eq('id', eventId)
    .single();

  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  const coupleName = event.couple_name;
  let suggested = `Ciao! Sono ${guestName} e sono qui al matrimonio di ${coupleName}. È una giornata speciale piena di gioia ed emozioni. Auguro a ${coupleName} tutto il bene del mondo, che la vostra vita insieme sia piena di amore e felicità. Auguri di cuore!`;

  const result = await generateText(
    `Genera UN SOLO testo breve (max 40 parole) in italiano per un video di auguri di matrimonio. L'ospite si chiama "${guestName}", gli sposi sono "${coupleName}". Deve essere caloroso, elegante, pronto per essere letto ad alta voce davanti a una videocamera. Non usare emoji. Non aggiungere spiegazioni. Scrivi solo il testo.`,
    undefined, 100,
  );
  if (result.content) suggested = result.content;

  return NextResponse.json({ text: suggested });
}
