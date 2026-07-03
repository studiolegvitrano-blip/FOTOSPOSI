import { NextRequest, NextResponse } from 'next/server';
import { generateChat } from '@fotosposi/core';

const SYSTEM_PROMPT = 'Sei un wedding planner AI. Aiuti gli sposi con consigli su matrimonio: organizzazione, tempistiche, fornitori, tradizioni. Rispondi in italiano, tono professionale ed elegante.';

export async function POST(request: NextRequest) {
  const { messages } = await request.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 });
  }
  const result = await generateChat(messages, SYSTEM_PROMPT, 500);
  return NextResponse.json(result);
}
