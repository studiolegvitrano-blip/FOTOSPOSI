import { createServiceClient, generateChat } from '@fotosposi/core';

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
  const result = await generateChat(messages, SYSTEM_PROMPT, 500);
  if (result.error) return { content: `AI non disponibile (${result.error}). Configura GROQ_API_KEY o GEMINI_API_KEY.` };
  return result;
}
