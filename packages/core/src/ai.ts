const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_URL = (key: string) => `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

function getProvider(): 'groq' | 'gemini' | null {
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

export async function generateChat(
  messages: { role: string; content: string }[],
  systemPrompt?: string,
  maxTokens = 500,
): Promise<{ content?: string; error?: string }> {
  const provider = getProvider();
  if (!provider) return { error: 'Nessuna chiave AI configurata. Aggiungi GROQ_API_KEY o GEMINI_API_KEY.' };

  try {
    if (provider === 'groq') {
      const groqMessages: { role: string; content: string }[] = [];
      if (systemPrompt) groqMessages.push({ role: 'system', content: systemPrompt });
      groqMessages.push(...messages);

      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: groqMessages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error?.message || `Errore Groq: ${res.status}` };
      return { content: data.choices?.[0]?.message?.content || '' };
    }

    // Gemini fallback
    const apiKey = process.env.GEMINI_API_KEY!;
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return { error: 'Nessun messaggio' };

    const contents = [
      ...history,
      { role: 'user', parts: [{ text: lastMsg.content }] },
    ];

    const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 } };
    if (systemPrompt) body.system_instruction = { parts: [{ text: systemPrompt }] };

    const res = await fetch(GEMINI_URL(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error?.message || 'Errore Gemini API' };
    return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function generateText(
  prompt: string,
  systemPrompt?: string,
  maxTokens = 300,
): Promise<{ content?: string; error?: string }> {
  return generateChat([{ role: 'user', content: prompt }], systemPrompt, maxTokens);
}
