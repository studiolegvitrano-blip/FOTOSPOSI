'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { uploadToStorage } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CHALLENGES, TAGS } from './challenges';
import type { VideoChallenge } from './challenges';

export default function VideoChallengesPage() {
  const params = useParams();
  const eventId = params.id as string;
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<Record<string, { before: string; after: string }>>({});
  const [activeChallenge, setActiveChallenge] = useState<VideoChallenge | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [fileBefore, setFileBefore] = useState<File | null>(null);
  const [fileAfter, setFileAfter] = useState<File | null>(null);
  const [previewBefore, setPreviewBefore] = useState('');
  const [previewAfter, setPreviewAfter] = useState('');
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);
  const [synced, setSynced] = useState(false);
  const [tab, setTab] = useState<'gallery' | 'viewer'>('gallery');
  const [error, setError] = useState('');

  useEffect(() => {
    const d = localStorage.getItem(`video_challenges_${eventId}`);
    if (d) {
      const parsed = JSON.parse(d);
      setSelected(new Set(parsed.selected || []));
      setCompleted(parsed.completed || {});
    }
  }, [eventId]);

  const save = (sel: Set<string>, comp: Record<string, { before: string; after: string }>) => {
    setSelected(sel);
    setCompleted(comp);
    localStorage.setItem(`video_challenges_${eventId}`, JSON.stringify({
      selected: [...sel], completed: comp,
    }));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next, completed);
  };

  const handleUpload = async (type: 'before' | 'after') => {
    if (!activeChallenge) return;
    const file = type === 'before' ? fileBefore : fileAfter;
    if (!file) return;
    setUploading(type);
    setError('');
    try {
      const path = `video-challenges/${eventId}/${activeChallenge.id}_${type}_${Date.now()}.webm`;
      const { url, error: err } = await uploadToStorage('media', path, file);
      if (err) { setError(err); return; }
      const existing = completed[activeChallenge.id] || { before: '', after: '' };
      const upd = { ...completed, [activeChallenge.id]: { ...existing, [type]: url! } };
      const sel = new Set(selected);
      sel.add(activeChallenge.id);
      save(sel, upd);
      setFileBefore(null); setFileAfter(null);
      setPreviewBefore(''); setPreviewAfter('');
      if (upd[activeChallenge.id]?.before && upd[activeChallenge.id]?.after) setTab('viewer');
    } catch (e: any) { setError(e.message); }
    setUploading(null);
  };

  const toggleSync = () => {
    if (!synced) {
      if (video1Ref.current && video2Ref.current) {
        video2Ref.current.currentTime = video1Ref.current.currentTime;
        video2Ref.current.play(); video1Ref.current.play();
      }
    } else { video1Ref.current?.pause(); video2Ref.current?.pause(); }
    setSynced(!synced);
  };

  const filtered = tagFilter ? CHALLENGES.filter(c => c.tags.includes(tagFilter)) : CHALLENGES;
  const doneCount = Object.keys(completed).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-black text-white">
      <div className="max-w-6xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-pink-400 bg-clip-text text-transparent">
              🎬 Sfide Addio al Celibato
            </h1>
            <p className="text-gray-400 text-sm">🎯 <strong>Prima</strong> = all'addio al celibato/nubilato con gli amici · <strong>Dopo</strong> = durante la cerimonia</p>
          </div>
          <Button variant="ghost" className="text-gray-400" asChild>
            <Link href={`/events/${eventId}`}>← Evento</Link>
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/5">
            {doneCount}/{CHALLENGES.length} completate
          </Badge>
          <div className="h-2 flex-1 max-w-xs bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-pink-400 rounded-full transition-all" style={{ width: `${(doneCount / CHALLENGES.length) * 100}%` }} />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button onClick={() => setTagFilter(null)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${!tagFilter ? 'bg-amber-400/20 text-amber-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              Tutte
            </button>
            {TAGS.map(t => (
              <button key={t} onClick={() => setTagFilter(t === tagFilter ? null : t)}
                className={`text-xs px-2.5 py-1 rounded-full capitalize transition-colors ${tagFilter === t ? 'bg-amber-400/20 text-amber-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === 'gallery' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map(c => {
              const isSelected = selected.has(c.id);
              const isDone = !!completed[c.id]?.before && !!completed[c.id]?.after;
              return (
                <Card key={c.id}
                  className={`cursor-pointer transition-all hover:scale-[1.02] bg-gray-900/80 border-gray-800 text-white hover:border-amber-500/50 ${isDone ? 'border-green-500/50' : isSelected ? 'border-amber-500/50' : ''}`}
                  onClick={() => { setActiveChallenge(c); setFileBefore(null); setFileAfter(null); setPreviewBefore(''); setPreviewAfter(''); setTab('viewer'); }}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="text-3xl">{c.emoji}</div>
                      {isDone && <Badge className="bg-green-500 text-xs">✅ Fatto</Badge>}
                    </div>
                    <CardTitle className="text-sm mt-2">{c.title}</CardTitle>
                    <p className="text-xs text-gray-400 line-clamp-2">{c.desc}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-1 flex-wrap">
                      {c.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 capitalize">{t}</span>)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {tab === 'viewer' && activeChallenge && (
          <div className="space-y-6">
            <button onClick={() => setTab('gallery')} className="text-sm text-amber-400 hover:underline flex items-center gap-1">
              ← Torna alle sfide
            </button>

            <div className="text-center">
              <span className="text-5xl">{activeChallenge.emoji}</span>
              <h2 className="text-2xl font-bold mt-2">{activeChallenge.title}</h2>
              <p className="text-gray-400">{activeChallenge.desc}</p>
              <div className="flex gap-1 justify-center mt-2">
                {activeChallenge.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 capitalize">{t}</span>)}
              </div>
            </div>

          {(() => {
            const ci = completed[activeChallenge.id];
            const hasBefore = !!ci?.before;
            const hasAfter = !!ci?.after;
            return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-900/80 border-gray-700 text-white">
                <CardHeader><CardTitle className="text-amber-400 text-sm">📱 Prima</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-gray-400">{activeChallenge.instructionsBefore}</p>
                  {hasBefore ? (
                    <div>
                      <video src={ci!.before} className="w-full rounded-lg" controls />
                      <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => { setFileBefore(null); setPreviewBefore(''); }}>
                        Ricarica
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input type="file" accept="video/*" capture="environment"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setFileBefore(f); setPreviewBefore(URL.createObjectURL(f)); } }}
                        className="text-sm w-full text-gray-300" />
                      {previewBefore && <video src={previewBefore} className="w-full rounded-lg" controls />}
                      <Button size="sm" disabled={!fileBefore || uploading === 'before'} onClick={() => handleUpload('before')} className="w-full">
                        {uploading === 'before' ? 'Caricamento...' : 'Carica video prima'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-900/80 border-gray-700 text-white">
                <CardHeader><CardTitle className="text-pink-400 text-sm">💍 Dopo</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-gray-400">{activeChallenge.instructionsAfter}</p>
                  {hasAfter ? (
                    <div>
                      <video src={ci!.after} className="w-full rounded-lg" controls />
                      <Button size="sm" variant="outline" className="mt-2 text-xs" onClick={() => { setFileAfter(null); setPreviewAfter(''); }}>
                        Ricarica
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input type="file" accept="video/*" capture="environment"
                        onChange={e => { const f = e.target.files?.[0]; if (f) { setFileAfter(f); setPreviewAfter(URL.createObjectURL(f)); } }}
                        className="text-sm w-full text-gray-300" />
                      {previewAfter && <video src={previewAfter} className="w-full rounded-lg" controls />}
                      <Button size="sm" disabled={!fileAfter || uploading === 'after'} onClick={() => handleUpload('after')} className="w-full">
                        {uploading === 'after' ? 'Caricamento...' : 'Carica video dopo'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>);
          })()}

            {(() => { const ci = completed[activeChallenge.id]; if (!ci?.before || !ci?.after) return null; return (
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-amber-400">🔥 Side-by-side</h3>
                  <p className="text-sm text-gray-500">Premi play e guarda la magia</p>
                  <Button onClick={toggleSync} size="lg" className="mt-2 bg-gradient-to-r from-amber-500 to-pink-500 text-white font-bold px-8">
                    {synced ? '⏸ Pausa' : '▶ Riproduci insieme'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden shadow-2xl shadow-amber-500/10 max-w-2xl mx-auto">
                  <div className="relative">
                    <span className="absolute top-2 left-2 z-10 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-amber-400">📱 Prima</span>
                    <video ref={video1Ref} src={ci.before} className="w-full aspect-[9/16] object-cover" />
                  </div>
                  <div className="relative">
                    <span className="absolute top-2 left-2 z-10 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-pink-400">💍 Dopo</span>
                    <video ref={video2Ref} src={ci.after} className="w-full aspect-[9/16] object-cover" />
                  </div>
                </div>
              </div>
            )})()}
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </div>
    </main>
  );
}
