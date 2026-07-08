const PROVIDERS = [
  { name: 'groq', key: () => process.env.GROQ_API_KEY, url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { name: 'nvidia', key: () => process.env.NVIDIA_API_KEY, url: 'https://integrate.api.nvidia.com/v1/chat/completions', model: 'deepseek-ai/deepseek-v4-pro' },
  { name: 'gemini', key: () => process.env.GEMINI_API_KEY, model: 'gemini-1.5-flash' },
];

async function callOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
  temperature: number,
): Promise<{ content?: string; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    signal: controller.signal,
  });
  clearTimeout(timeout);
  const data = await res.json();
  if (!res.ok) return { error: data.error?.message || `Errore ${url}: ${res.status}` };
  return { content: data.choices?.[0]?.message?.content || '' };
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt?: string,
  maxTokens?: number,
): Promise<{ content?: string; error?: string }> {
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg) return { error: 'Nessun messaggio' };
  const contents = [...history, { role: 'user', parts: [{ text: lastMsg.content }] }];
  const body: Record<string, unknown> = { contents, generationConfig: { maxOutputTokens: maxTokens ?? 500, temperature: 0.7 } };
  if (systemPrompt) body.system_instruction = { parts: [{ text: systemPrompt }] };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error?.message || 'Errore Gemini API' };
  return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '' };
}

export async function generateChat(
  messages: { role: string; content: string }[],
  systemPrompt?: string,
  maxTokens = 500,
): Promise<{ content?: string; error?: string }> {
  const groqMessages: { role: string; content: string }[] = [];
  if (systemPrompt) groqMessages.push({ role: 'system', content: systemPrompt });
  groqMessages.push(...messages);

  const errors: string[] = [];

  for (const p of PROVIDERS) {
    const key = p.key();
    if (!key) continue;
    try {
      if (p.name === 'gemini') {
        const result = await callGemini(key, p.model, messages, systemPrompt, maxTokens);
        if (result.content) return result;
        errors.push(`Gemini: ${result.error}`);
      } else {
        const result = await callOpenAICompatible(p.url, key, p.model, groqMessages, maxTokens, 0.7);
        if (result.content) return result;
        errors.push(`${p.name}: ${result.error}`);
      }
    } catch (e: any) {
      errors.push(`${p.name}: ${e.message}`);
    }
  }

  return { error: `Tutti i provider AI hanno fallito: ${errors.join('; ')}` };
}

export async function generateText(
  prompt: string,
  systemPrompt?: string,
  maxTokens = 300,
): Promise<{ content?: string; error?: string }> {
  return generateChat([{ role: 'user', content: prompt }], systemPrompt, maxTokens);
}
