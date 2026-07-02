'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { uploadToStorage, compressImage } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TARGETS = [
  { id: 'amico-sposo', label: 'Amico dello sposo', emoji: '🍻', desc: 'Il primo brindisi tra amici' },
  { id: 'sposa', label: 'Sposa', emoji: '👰', desc: 'La sposa al suo primo calice' },
  { id: 'nonna', label: 'Nonna', emoji: '👵', desc: 'La nonna che si concede un bicchiere' },
  { id: 'zia', label: 'Zia', emoji: '👩', desc: 'La zia scatenata al primo giro' },
  { id: 'ultimo-bicchiere', label: 'Ultimo bicchiere', emoji: '🥂', desc: 'L\'ultimo brindisi della serata' },
];

export default function PrimoAlcolicoPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [progress, setProgress] = useState<Record<string, { url: string; name: string }>>({});
  const [activeTarget, setActiveTarget] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [guestName, setGuestName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'photo' | 'video'>('photo');

  useEffect(() => {
    const saved = localStorage.getItem(`primo_alcolico_${eventId}`);
    if (saved) setProgress(JSON.parse(saved));
  }, [eventId]);

  const saveProgress = (p: typeof progress) => {
    setProgress(p);
    localStorage.setItem(`primo_alcolico_${eventId}`, JSON.stringify(p));
  };

  const handleCapture = async () => {
    if (!activeTarget || !mediaFile || !guestName.trim()) return;
    setUploading(true);
    try {
      const blob = mode === 'photo' ? await compressImage(mediaFile) : mediaFile;
      const ext = mode === 'photo' ? 'jpg' : 'webm';
      const path = `primo-alcolico/${eventId}/${activeTarget}_${Date.now()}.${ext}`;
      const { url, error } = await uploadToStorage('media', path, blob);
      if (error) return;
      saveProgress({ ...progress, [activeTarget]: { url: url!, name: guestName } });
      setActiveTarget(null);
      setMediaFile(null);
      setMediaPreview('');
    } catch {}
    setUploading(false);
  };

  const completed = Object.keys(progress).length;
  const total = TARGETS.length;
  const pct = Math.round((completed / total) * 100);

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🍷 Primo Alcolico</h1>
          <p className="text-text-muted text-sm">Cattura il primo bicchiere di... e brinda con noi!</p>
        </div>
        <Button variant="ghost" asChild><Link href={`/events/${eventId}/games`}>← Giochi</Link></Button>
      </div>

      <Card className="bg-gradient-to-r from-amber-50 to-orange-50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{pct === 100 ? '🎉' : '🍷'}</div>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Completato: {completed}/{total}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TARGETS.map(t => {
          const done = progress[t.id];
          return (
            <Card key={t.id} className={`cursor-pointer transition-all hover:shadow-md ${done ? 'border-green-400 bg-green-50' : activeTarget === t.id ? 'border-amber-400 ring-2 ring-amber-200' : ''}`}
              onClick={() => !done && setActiveTarget(t.id)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{t.emoji}</span>
                    <CardTitle className="text-sm">{t.label}</CardTitle>
                  </div>
                  {done ? <Badge className="bg-green-500">Fatto!</Badge> : <Badge variant="outline">Da fare</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                {done ? (
                  <div className="flex items-center gap-2">
                    {done.url && (mode === 'video' ? (
                      <video src={done.url} className="w-16 h-12 rounded object-cover" muted />
                    ) : (
                      <img src={done.url} className="w-16 h-12 rounded object-cover" />
                    ))}
                    <p className="text-xs text-text-muted">da {done.name}</p>
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">{t.desc}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeTarget && !progress[activeTarget] && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {TARGETS.find(t => t.id === activeTarget)?.emoji} {TARGETS.find(t => t.id === activeTarget)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <input value={guestName} onChange={e => setGuestName(e.target.value)}
              placeholder="Nome di chi brinda..."
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" variant={mode === 'photo' ? 'default' : 'outline'} onClick={() => setMode('photo')}>📷 Foto</Button>
              <Button size="sm" variant={mode === 'video' ? 'default' : 'outline'} onClick={() => setMode('video')}>🎥 Video</Button>
            </div>
            <input type="file" accept={mode === 'photo' ? 'image/*' : 'video/*'} capture="environment"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); }
              }}
              className="text-sm w-full" />
            {mediaPreview && (
              mode === 'video'
                ? <video src={mediaPreview} className="w-full max-h-64 rounded-md" controls />
                : <img src={mediaPreview} alt="" className="w-full max-h-64 rounded-md object-contain" />
            )}
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button onClick={handleCapture} disabled={!mediaFile || !guestName.trim() || uploading}>
              {uploading ? 'Salvataggio...' : 'Salva!'}
            </Button>
            <Button variant="ghost" onClick={() => setActiveTarget(null)}>Annulla</Button>
          </CardFooter>
        </Card>
      )}

      {completed === total && (
        <Card className="bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-300">
          <CardContent className="text-center py-6 space-y-2">
            <div className="text-5xl">🥳</div>
            <h3 className="text-xl font-bold">Missione compiuta!</h3>
            <p className="text-text-muted">Hai catturato tutti i brindisi della serata. Salute! 🍷</p>
            <Button variant="outline" onClick={() => { localStorage.removeItem(`primo_alcolico_${eventId}`); setProgress({}); }}>
              Ricomincia
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-xs text-text-muted">
        I media vengono salvati su Supabase Storage. Progresso salvato localmente.
      </p>
    </main>
  );
}
