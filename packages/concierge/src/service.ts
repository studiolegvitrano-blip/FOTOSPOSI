import { createServiceClient } from '@fotosposi/core';

export interface ConciergeMessage {
  id: string;
  event_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: any;
  created_at: string;
}

export async function getMessages(eventId: string, userId: string): Promise<{ messages?: ConciergeMessage[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('concierge_messages').select('*')
    .eq('event_id', eventId).eq('user_id', userId).order('created_at');
  if (error) return { error: error.message };
  return { messages: data ?? [] };
}

export async function sendMessage(params: {
  event_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
}): Promise<{ message?: ConciergeMessage; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('concierge_messages').insert(params).select().single();
  if (error) return { error: error.message };

  const anonKey = process.env.ANTHROPIC_API_KEY;

  return { message: data };
}

export async function getAiResponse(messages: { role: string; content: string }[]): Promise<{ content?: string; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { content: 'Chat AI non disponibile. Configura ANTHROPIC_API_KEY per abilitare il concierge AI.' };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 500, system: 'Sei un wedding planner AI. Aiuti gli sposi con consigli su matrimonio: organizzazione, tempistiche, fornitori, tradizioni italiane.', messages }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error?.message || 'Errore Claude API' };
    return { content: data.content?.[0]?.text || '' };
  } catch (e: any) {
    return { error: e.message };
  }
}
