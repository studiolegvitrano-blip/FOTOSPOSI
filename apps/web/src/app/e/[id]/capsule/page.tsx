'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getEventByCode } from '@fotosposi/events';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

type SenderType = 'sposo' | 'sposa' | 'invitato';
type RecipientType = 'sposi' | 'sposo' | 'sposa' | 'singolo' | 'gruppo';

export default function CapsulePage() {
  const { id } = useParams<{ id: string }>();
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'form' | 'preview' | 'sent'>('form');

  const [senderType, setSenderType] = useState<SenderType>('invitato');
  const [senderName, setSenderName] = useState('');
  const [recipientType, setRecipientType] = useState<RecipientType>('sposi');
  const [recipientName, setRecipientName] = useState('');
  const [recipientGroup, setRecipientGroup] = useState('');
  const [messageType, setMessageType] = useState<'text' | 'photo' | 'video'>('text');
  const [content, setContent] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    getEventByCode(id).then(({ event }) => {
      if (event) { setEventId(event.id); setEventName(event.couple_name); }
      else setEventName('Evento');
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async () => {
    if (!eventId || !senderName.trim()) return;
    setSending(true);

    const revealDate = new Date();
    revealDate.setFullYear(revealDate.getFullYear() + 1);
    const revealAt = revealDate.toISOString();

    let fileUrl: string | undefined;
    let storagePath: string | undefined;

    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`/api/time-capsule/${eventId}/upload`, { method: 'POST', body: formData });
      if (uploadRes.ok) {
        const d = await uploadRes.json();
        fileUrl = d.url;
        storagePath = d.path;
      }
    }

    const res = await fetch(`/api/time-capsule/${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_type: senderType,
        sender_name: senderName,
        recipient_type: recipientType,
        recipient_name: recipientType === 'singolo' ? recipientName : undefined,
        recipient_group: recipientType === 'gruppo' ? recipientGroup : undefined,
        message_type: messageType,
        content: messageType === 'text' ? content : undefined,
        file_url: fileUrl,
        storage_path: storagePath,
        reveal_at: revealAt,
      }),
    });

    setSending(false);
    if (res.ok) setStep('sent');
  };

  if (loading) return <main className="max-w-2xl mx-auto p-4 text-center">Caricamento...</main>;

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Capsula del Tempo</h1>
        <p className="text-text-muted">{eventName}</p>
        <p className="text-sm text-text-muted">Lascia un messaggio che verrà rivelato tra un anno</p>
      </div>

      {step === 'form' && (
        <Card>
          <CardHeader><CardTitle>Il tuo messaggio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Chi sei?</label>
              <div className="flex gap-2 mt-1">
                {(['sposo', 'sposa', 'invitato'] as SenderType[]).map(t => (
                  <Button key={t} size="sm" variant={senderType === t ? 'default' : 'outline'} onClick={() => setSenderType(t)}>
                    {t === 'sposo' ? 'Sposo' : t === 'sposa' ? 'Sposa' : 'Invitato'}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Il tuo nome</label>
              <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Nome" />
            </div>

            <div>
              <label className="text-sm font-medium">Destinatario</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {([['sposi', 'Agli Sposi'], ['sposo', 'Sposo'], ['sposa', 'Sposa'], ['singolo', 'Singolo invitato'], ['gruppo', 'Gruppo']] as [RecipientType, string][]).map(([t, label]) => (
                  <Button key={t} size="sm" variant={recipientType === t ? 'default' : 'outline'} onClick={() => setRecipientType(t)}>
                    {label}
                  </Button>
                ))}
              </div>
              {recipientType === 'singolo' && (
                <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-2" value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Nome destinatario" />
              )}
              {recipientType === 'gruppo' && (
                <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-2" value={recipientGroup} onChange={e => setRecipientGroup(e.target.value)} placeholder="Nome gruppo (es. Amici, Parenti)" />
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Tipo messaggio</label>
              <div className="flex gap-2 mt-1">
                {([['text', 'Testo'], ['photo', 'Foto'], ['video', 'Video']] as ['text' | 'photo' | 'video', string][]).map(([t, label]) => (
                  <Button key={t} size="sm" variant={messageType === t ? 'default' : 'outline'} onClick={() => setMessageType(t)}>
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {messageType === 'text' && (
              <textarea className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={content} onChange={e => setContent(e.target.value)} placeholder="Scrivi il tuo messaggio..." rows={4} />
            )}

            {(messageType === 'photo' || messageType === 'video') && (
              <input type="file" accept={messageType === 'photo' ? 'image/*' : 'video/*'} onChange={e => setFile(e.target.files?.[0] || null)} />
            )}

            <p className="text-xs text-text-muted">Questo messaggio verrà custodito al sicuro e consegnato tra un anno.</p>

            <Button onClick={handleSubmit} disabled={sending || !senderName.trim()}>
              {sending ? 'Invio in corso...' : 'Salva nella capsula del tempo'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'sent' && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-lg font-medium">Messaggio custodito nella capsula del tempo!</p>
            <p className="text-sm text-text-muted">Verrà consegnato tra un anno, giorno per giorno.</p>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
