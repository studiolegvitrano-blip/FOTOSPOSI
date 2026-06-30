'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { getMessages, sendMessage, getAiResponse } from '@fotosposi/concierge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function ConciergePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      getMessages(id, u.id).then(r => { if (r.messages) setMessages(r.messages); });
    });
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!user || !input.trim() || sending) return;
    setSending(true);
    const text = input.trim();
    setInput('');

    const userMsg = await sendMessage({ event_id: id, user_id: user.id, role: 'user', content: text });
    if (userMsg.message) setMessages(prev => [...prev, userMsg.message!]);

    const history = [...messages, { role: 'user', content: text }];
    const aiRes = await getAiResponse(history.map(m => ({ role: m.role, content: m.content })));

    if (aiRes.content) {
      const aiMsg = await sendMessage({ event_id: id, user_id: user.id, role: 'assistant', content: aiRes.content });
      if (aiMsg.message) setMessages(prev => [...prev, aiMsg.message!]);
    }
    setSending(false);
  };

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Concierge AI</h1>
        <Button variant="ghost" onClick={() => router.push(`/events/${id}`)}>← Evento</Button>
      </div>
      <p className="text-text-muted text-sm">Chiedi consigli su organizzazione, tempistiche, fornitori e tradizioni</p>

      <Card className="h-[60vh] flex flex-col">
        <CardContent className="flex-1 overflow-y-auto space-y-3 p-4">
          {messages.length === 0 && (
            <div className="text-center text-text-muted py-8">
              <p>Chiedimi qualcosa sul tuo matrimonio!</p>
              <p className="text-sm mt-2">Es: "Quali sono i tempi giusti per organizzare un matrimonio?"</p>
              <p className="text-sm">"Consigliami un fotografo a Firenze"</p>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${m.role === 'user' ? 'bg-brand text-white' : 'bg-muted'}`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && <div className="text-center text-text-muted text-sm">L'AI sta scrivendo...</div>}
          <div ref={bottomRef} />
        </CardContent>
        <div className="p-3 border-t border-border flex gap-2">
          <input
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
            value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Scrivi un messaggio..."
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()}>Invia</Button>
        </div>
      </Card>
    </main>
  );
}
