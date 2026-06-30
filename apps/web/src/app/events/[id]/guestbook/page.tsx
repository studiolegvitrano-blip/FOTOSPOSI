'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient, getCurrentUser, createServiceClient } from '@fotosposi/core';
import { getVideoMessages, createVideoMessage } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { VideoRecorder } from '@/components/video-recorder';

export default function GuestbookPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [tab, setTab] = useState<'record' | 'view'>('view');
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      setName(u.user_metadata?.name || '');
    });
    loadMessages();
  }, [id]);

  const loadMessages = async () => {
    const r = await getVideoMessages(id as string, 'guestbook');
    if (r.messages) setMessages(r.messages);
  };

  const handleVideoComplete = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const fileName = `guestbook/${id}/${user.id}_${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, blob);
      if (uploadError) { alert('Upload fallito: ' + uploadError.message); return; }
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
      await createVideoMessage({ event_id: id, from_user: name || 'Anonimo', type: 'guestbook', url: publicUrl });
      await loadMessages();
      setTab('view');
    } catch (e: any) {
      alert('Errore: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Video Guestbook</h1>
        <div className="flex gap-2">
          <Button variant={tab === 'view' ? 'default' : 'outline'} onClick={() => setTab('view')}>Vedi messaggi</Button>
          <Button variant={tab === 'record' ? 'default' : 'outline'} onClick={() => setTab('record')}>Registra</Button>
          <Button variant="ghost" onClick={() => router.push(`/events/${id}`)}>←</Button>
        </div>
      </div>

      {tab === 'record' && (
        <Card>
          <CardHeader><CardTitle>Lascia un messaggio video</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Il tuo nome</label>
              <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Nome" />
            </div>
            <VideoRecorder onRecordingComplete={handleVideoComplete} maxDuration={30} />
            {uploading && <p className="text-sm text-text-muted text-center">Caricamento video...</p>}
          </CardContent>
        </Card>
      )}

      {tab === 'view' && (
        <div className="space-y-4">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-text-muted">
                Nessun messaggio video ancora. <br />
                <Button variant="link" onClick={() => setTab('record')}>Registra il primo!</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {messages.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-3">
                    <video src={m.url} controls className="w-full rounded-md aspect-[4/3] object-cover bg-black" />
                    <p className="text-sm mt-2 font-medium">{m.from_user}</p>
                    <p className="text-xs text-text-muted">{new Date(m.created_at).toLocaleDateString('it-IT')}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
