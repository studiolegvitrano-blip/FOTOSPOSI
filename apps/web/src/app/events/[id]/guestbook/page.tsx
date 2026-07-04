'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { getVideoMessages, createVideoMessage } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { VideoRecorder } from '@/components/video-recorder';
import { Upload, Globe, Lock } from 'lucide-react';

export default function GuestbookPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [tab, setTab] = useState<'record' | 'view'>('view');
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [suggestedText, setSuggestedText] = useState('');
  const [loadingText, setLoadingText] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      setName(u.user_metadata?.name || u.email || '');
    });
    loadMessages();
  }, [id]);

  const loadMessages = async () => {
    const r = await getVideoMessages(id, 'guestbook');
    if (r.messages) setMessages(r.messages);
  };

  const handleTabRecord = async () => {
    setTab('record');
    setLoadingText(true);
    try {
      const res = await fetch(`/api/guestbook/suggested-text?eventId=${id}&guestName=${encodeURIComponent(name || 'amico')}`);
      const data = await res.json();
      if (data.text) setSuggestedText(data.text);
    } catch { setSuggestedText(''); }
    setLoadingText(false);
  };

  const uploadToR2 = async (blob: Blob): Promise<string | null> => {
    try {
      const r2Resp = await fetch('/api/r2/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: `guestbook_${Date.now()}.webm`, contentType: 'video/webm', prefix: `events/${id}/guestbook` }),
      });
      const r2Data = await r2Resp.json();
      if (!r2Resp.ok || !r2Data.presignedUrl) return null;
      const uploadResp = await fetch(r2Data.presignedUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'video/webm' } });
      if (!uploadResp.ok) return null;
      return r2Data.key;
    } catch { return null; }
  };

  const saveVideo = async (blob: Blob) => {
    if (!user) return;
    setUploading(true);
    try {
      const r2Key = await uploadToR2(blob);
      if (r2Key) {
        const { error } = await createVideoMessage({
          event_id: id,
          from_user: user.id,
          from_name: name || 'Anonimo',
          type: 'guestbook',
          url: r2Key,
          r2_key: r2Key,
          is_public: isPublic,
        });
        if (error) { alert('Errore salvataggio: ' + error); return; }
      } else { alert('Upload fallito'); return; }
      await loadMessages();
      setTab('view');
    } catch (e: any) { alert('Errore: ' + e.message); }
    finally { setUploading(false); }
  };

  const handleVideoComplete = async (blob: Blob) => { await saveVideo(blob); };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    setUploading(true);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const r2Key = await uploadToR2(file);
      if (r2Key) {
        const { error } = await createVideoMessage({
          event_id: id,
          from_user: user.id,
          from_name: name || 'Anonimo',
          type: 'guestbook',
          url: r2Key,
          r2_key: r2Key,
          is_public: isPublic,
        });
        if (!error) ok++;
      }
    }
    await loadMessages();
    setTab('view');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const msgSrc = (m: any) => m.r2_key ? `/api/media/${m.id}/download` : m.url;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Video Guestbook</h1>
        <div className="flex gap-2">
          <Button variant={tab === 'view' ? 'default' : 'outline'} onClick={() => setTab('view')}>Vedi messaggi</Button>
          <Button variant={tab === 'record' ? 'default' : 'outline'} onClick={handleTabRecord}>Registra</Button>
          <Button variant="ghost" onClick={() => router.push(`/events/${id}`)}>← Torna</Button>
        </div>
      </div>

      {tab === 'record' && (
        <Card>
          <CardHeader>
            <CardTitle>Lascia un messaggio video</CardTitle>
            <p className="text-sm text-text-muted mt-1">
              Registra un video dal vivo o carica uno o piu file dal telefono.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Il tuo nome</label>
              <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Nome" />
            </div>
            <div className="flex gap-4 items-center">
              <span className="text-sm font-medium">Visibile a:</span>
              <Button variant={isPublic ? 'default' : 'outline'} size="sm" onClick={() => setIsPublic(true)}>
                <Globe className="w-4 h-4 mr-1" /> Tutti
              </Button>
              <Button variant={!isPublic ? 'default' : 'outline'} size="sm" onClick={() => setIsPublic(false)}>
                <Lock className="w-4 h-4 mr-1" /> Solo sposi
              </Button>
            </div>
            {loadingText ? (
              <p className="text-sm text-text-muted text-center">Generazione testo suggerito...</p>
            ) : (
              <VideoRecorder onRecordingComplete={handleVideoComplete} maxDuration={30} suggestedText={suggestedText} />
            )}
            <div className="text-center pt-2 border-t border-border">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Carica video dal telefono
              </Button>
              <p className="text-xs text-text-muted mt-1">Puoi selezionare piu video contemporaneamente</p>
            </div>
            <input ref={fileRef} type="file" accept="video/*" multiple onChange={handleFilesSelected} className="hidden" />
            {uploading && <p className="text-sm text-text-muted text-center">Caricamento video in corso...</p>}
          </CardContent>
        </Card>
      )}

      {tab === 'view' && (
        <div className="space-y-4">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-text-muted">
                Nessun messaggio video ancora.
                <Button variant="link" onClick={handleTabRecord}>Registra il primo!</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {messages.map((m: any) => (
                <Card key={m.id}>
                  <CardContent className="p-3">
                    <video src={msgSrc(m)} controls className="w-full rounded-md aspect-[4/3] object-cover bg-black" />
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-sm font-medium">{m.from_name || m.from_user}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {m.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {m.is_public ? 'Pubblico' : 'Privato'}
                      </div>
                    </div>
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
