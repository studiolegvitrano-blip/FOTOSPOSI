import { createServiceClient } from '@fotosposi/core';

const SYSTEM_PROMPT = 'Sei un wedding planner AI. Aiuti gli sposi con consigli su matrimonio: organizzazione, tempistiche, fornitori, tradizioni. Rispondi in italiano, tono professionale ed elegante.';

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
  return { message: data };
}

export async function getAiResponse(messages: { role: string; content: string }[]): Promise<{ content?: string; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { content: 'Chat AI non disponibile. Configura GEMINI_API_KEY per abilitare il concierge AI.' };

  try {
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastMsg = messages[messages.length - 1];

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: lastMsg.content }] },
    ];

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 500, temperature: 0.7 },
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error?.message || 'Errore Gemini API' };
    return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
  } catch (e: any) {
    return { error: e.message };
  }
}
