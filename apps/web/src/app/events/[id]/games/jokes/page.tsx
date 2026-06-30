'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createJoke, getJokes, deleteJoke } from '@fotosposi/games';
import { createClient, getCurrentUser } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { JokeEntry } from '@fotosposi/games';

export default function JokesPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [revealDate, setRevealDate] = useState('');
  const [revealTime, setRevealTime] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [revealed, setRevealed] = useState<JokeEntry[]>([]);
  const [pending, setPending] = useState<JokeEntry[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getCurrentUser().then(({ user }) => { if (user) setUserId(user.id); });
    loadJokes();
  }, [eventId]);

  const loadJokes = () => {
    getJokes(eventId, true).then((r) => { if (r.jokes) setRevealed(r.jokes); });
    getJokes(eventId, false).then((r) => { if (r.jokes) setPending(r.jokes); });
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setError('');
    setUploading(true);

    const revealAt = revealDate && revealTime
      ? new Date(`${revealDate}T${revealTime}`).toISOString()
      : new Date(Date.now() + 86400000).toISOString();

    let mediaUrl = '';
    if (mediaFile) {
      const supabase = createClient();
      const fileName = `jokes/${eventId}/${userId}_${Date.now()}_${mediaFile.name}`;
      const { error: uploadError } = await supabase.storage.from('media').upload(fileName, mediaFile);
      if (uploadError) { setError('Upload media fallito'); setUploading(false); return; }
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
      mediaUrl = publicUrl;
    }

    const jokeContent = mediaUrl ? `${content}\n---MEDIA:${mediaUrl}` : content;
    const { error: err } = await createJoke({ event_id: eventId, from_user: userId, content: jokeContent, reveal_at: revealAt });

    if (err) {
      setError(err);
    } else {
      setContent('');
      setMediaFile(null);
      setMediaPreview('');
      loadJokes();
    }
    setUploading(false);
  };

  const handleDelete = async (jokeId: string) => {
    await deleteJoke(jokeId);
    loadJokes();
  };

  const renderJokeContent = (joke: JokeEntry) => {
    const mediaMatch = joke.content.match(/---MEDIA:(.+)/);
    if (mediaMatch) {
      const parts = joke.content.split('---MEDIA:');
      const text = parts[0] ?? '';
      const mediaUrl = parts[1] ?? '';
      return (
        <div>
          {text.trim() && <p className="mb-2">{text.trim()}</p>}
          {mediaUrl && (
            mediaUrl.match(/\.(mp4|webm|mov)$/i)
              ? <video src={mediaUrl} controls className="w-full max-w-sm rounded-md" />
              : <img src={mediaUrl} alt="" className="w-full max-w-sm rounded-md" />
          )}
        </div>
      );
    }
    return <p>{joke.content}</p>;
  };

  const nextReveal = pending.length > 0
    ? new Date(Math.min(...pending.map(j => new Date(j.reveal_at).getTime())))
    : null;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Angolo scherzi</h1>
        <Button variant="ghost" asChild><Link href={`/events/${eventId}/games`}>← Giochi</Link></Button>
      </div>
      <p className="text-text-muted">I contenuti restano nascosti fino al reveal scelto</p>

      {nextReveal && (
        <Card className="bg-muted">
          <CardContent className="py-3 text-sm text-center">
            Prossimo reveal: {nextReveal.toLocaleString('it-IT')}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Aggiungi scherzo</CardTitle></CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Contenuto</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={3}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm mt-1"
                placeholder="Scrivi qui il tuo scherzo (testo, battuta, dedica...)" />
            </div>
            <div>
              <label className="text-sm font-medium">Media (opzionale)</label>
              <input type="file" accept="image/*,video/*" onChange={handleMediaSelect} className="mt-1 text-sm" />
              {mediaPreview && (
                mediaFile?.type.startsWith('video/')
                  ? <video src={mediaPreview} className="w-full max-w-xs mt-2 rounded-md" />
                  : <img src={mediaPreview} alt="" className="w-full max-w-xs mt-2 rounded-md" />
              )}
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Data reveal</label>
                <input type="date" value={revealDate} onChange={(e) => setRevealDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium">Ora reveal</label>
                <input type="time" value={revealTime} onChange={(e) => setRevealTime(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" />
              </div>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={uploading}>{uploading ? 'Caricamento...' : 'Invia scherzo'}</Button>
          </CardFooter>
        </form>
      </Card>

      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">In attesa di reveal ({pending.length})</h2>
          {pending.map((j) => (
            <Card key={j.id} className="bg-amber-50">
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="warning">Nascosto</Badge>
                  <span className="text-sm text-text-muted">Reveal: {new Date(j.reveal_at).toLocaleString('it-IT')}</span>
                </div>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(j.id)}>Elimina</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {revealed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Scherzi rivelati</h2>
          {revealed.map((j) => (
            <Card key={j.id}>
              <CardContent className="py-3">
                {renderJokeContent(j)}
                <p className="text-xs text-text-muted mt-2">Rivelato il {new Date(j.reveal_at).toLocaleDateString('it-IT')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
