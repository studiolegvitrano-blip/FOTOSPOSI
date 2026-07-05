'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CapsuleMessage {
  id: string;
  sender_type: string;
  sender_name: string;
  recipient_type: string;
  recipient_name: string | null;
  recipient_group: string | null;
  message_type: string;
  content: string | null;
  file_url: string | null;
  drive_file_id: string | null;
  drive_sync_status: string;
  reveal_at: string;
  delivered_at: string | null;
  downloaded_at: string | null;
  created_at: string;
}

export default function CapsuleManagerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [messages, setMessages] = useState<CapsuleMessage[]>([]);

  useEffect(() => {
    getCurrentUser().then(({ user }) => { if (!user) router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); });
    load();
  }, [id]);

  const load = async () => {
    const res = await fetch(`/api/time-capsule/${id}`);
    if (res.ok) { const d = await res.json(); setMessages(d.messages || []); }
  };

  const handleSync = async (msgId: string) => {
    const res = await fetch(`/api/time-capsule/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', messageId: msgId }),
    });
    if (res.ok) load();
  };

  const label = (t: string) => {
    const map: Record<string, string> = {
      sposo: 'Sposo', sposa: 'Sposa', invitato: 'Invitato',
      sposi: 'Agli Sposi', singolo: 'Singolo', gruppo: 'Gruppo',
      text: 'Testo', photo: 'Foto', video: 'Video',
      pending: 'In attesa', synced: 'Su Drive', failed: 'Fallito',
    };
    return map[t] || t;
  };

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Capsula del Tempo</h1>
        <Button variant="ghost" onClick={() => router.push(`/events/${id}`)}>←</Button>
      </div>

      <p className="text-sm text-text-muted">
        Messaggi lasciati per il futuro. I file vengono sincronizzati su Drive e rimossi da Supabase.
        Alla data di consegna verranno inviati via WhatsApp/Email.
      </p>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-text-muted">
            Nessun messaggio nella capsula del tempo.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map(msg => (
            <Card key={msg.id}>
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      Da: <Badge variant="outline">{label(msg.sender_type)}</Badge> {msg.sender_name}
                    </p>
                    <p className="text-sm text-text-muted">
                      A: <Badge variant="outline">{label(msg.recipient_type)}</Badge>
                      {msg.recipient_name && ` — ${msg.recipient_name}`}
                      {msg.recipient_group && ` — ${msg.recipient_group}`}
                    </p>
                  </div>
                  <Badge variant={msg.drive_sync_status === 'synced' ? 'default' : 'secondary'}>
                    {label(msg.drive_sync_status)}
                  </Badge>
                </div>

                <div className="text-sm space-y-1">
                  <p>Tipo: {label(msg.message_type)}</p>
                  {msg.content && <p className="italic bg-muted p-2 rounded">"{msg.content}"</p>}
                  {msg.file_url && <p className="text-xs text-brand">🔗 file presente</p>}
                  {msg.drive_file_id && <p className="text-xs text-text-muted">Drive ID: {msg.drive_file_id}</p>}
                  <p className="text-xs text-text-muted">
                    Rivelazione: {new Date(msg.reveal_at).toLocaleDateString('it-IT')}
                    {msg.delivered_at ? ` · Consegnato: ${new Date(msg.delivered_at).toLocaleDateString('it-IT')}` : ' · In attesa'}
                    {msg.downloaded_at ? ` · Scaricato: ${new Date(msg.downloaded_at).toLocaleDateString('it-IT')}` : ''}
                  </p>
                </div>

                <div className="flex gap-2">
                  {msg.drive_sync_status !== 'synced' && msg.file_url && (
                    <Button size="sm" variant="outline" onClick={() => handleSync(msg.id)}>
                      Sincronizza su Drive
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
