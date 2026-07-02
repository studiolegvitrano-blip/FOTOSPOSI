'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { uploadToStorage } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function WowWalkPage() {
  const params = useParams();
  const eventId = params.id as string;

  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);

  const [videoBefore, setVideoBefore] = useState<string | null>(null);
  const [videoAfter, setVideoAfter] = useState<string | null>(null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforePreview, setBeforePreview] = useState<string>('');
  const [afterPreview, setAfterPreview] = useState<string>('');
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);
  const [mode, setMode] = useState<'upload' | 'view'>('upload');
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(`wow_walk_${eventId}`);
    if (saved) {
      const d = JSON.parse(saved);
      if (d.before) setVideoBefore(d.before);
      if (d.after) setVideoAfter(d.after);
      if (d.before && d.after) setMode('view');
    }
  }, [eventId]);

  const handleUpload = async (type: 'before' | 'after') => {
    const file = type === 'before' ? beforeFile : afterFile;
    if (!file) return;
    setUploading(type);
    setError('');
    try {
      const path = `wow-walk/${eventId}/${type}_${Date.now()}.webm`;
      const { url, error: err } = await uploadToStorage('media', path, file);
      if (err) { setError(err); return; }
      const key = type === 'before' ? 'before' : 'after';
      const upd = { ...(type === 'before' ? { before: url!, after: videoAfter } : { before: videoBefore, after: url! }) };
      if (type === 'before') setVideoBefore(url!);
      else setVideoAfter(url!);
      localStorage.setItem(`wow_walk_${eventId}`, JSON.stringify(upd));
      if (upd.before && upd.after) setMode('view');
    } catch (e: any) { setError(e.message); }
    setUploading(null);
  };

  const toggleSync = () => {
    if (!synced) {
      if (video1Ref.current && video2Ref.current) {
        video2Ref.current.currentTime = video1Ref.current.currentTime;
        video2Ref.current.play();
        video1Ref.current.play();
      }
    } else {
      video1Ref.current?.pause();
      video2Ref.current?.pause();
    }
    setSynced(!synced);
  };

  const handleReset = () => {
    localStorage.removeItem(`wow_walk_${eventId}`);
    setVideoBefore(null);
    setVideoAfter(null);
    setBeforeFile(null);
    setAfterFile(null);
    setBeforePreview('');
    setAfterPreview('');
    setMode('upload');
    setSynced(false);
  };

  const handleVideo1Time = () => {
    if (synced && video1Ref.current && video2Ref.current) {
      const diff = Math.abs(video2Ref.current.currentTime - video1Ref.current.currentTime);
      if (diff > 0.3) video2Ref.current.currentTime = video1Ref.current.currentTime;
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-amber-400">La Passeggiata</h1>
            <p className="text-gray-400 text-sm">Telefono a terra... mano nella mano... emozione pura</p>
          </div>
          <Button variant="ghost" asChild className="text-gray-400">
            <Link href={`/events/${eventId}`}>← Evento</Link>
          </Button>
        </div>

        {mode === 'upload' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-gray-900 border-gray-700 text-white">
              <CardHeader>
                <CardTitle className="text-amber-400">📱 Prima — Telefono a terra</CardTitle>
                <p className="text-sm text-gray-400">Filmato col telefono appoggiato a terra mentre camminate mano nella mano</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <input type="file" accept="video/*" capture="environment"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setBeforeFile(f); setBeforePreview(URL.createObjectURL(f)); } }}
                  className="text-sm w-full text-gray-300" />
                {beforePreview && (
                  <video src={beforePreview} className="w-full rounded-lg" controls />
                )}
                <Button className="w-full" disabled={!beforeFile || uploading === 'before'}
                  onClick={() => handleUpload('before')}>
                  {uploading === 'before' ? 'Caricamento...' : videoBefore ? 'Ricarica' : 'Carica video'}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-gray-700 text-white">
              <CardHeader>
                <CardTitle className="text-amber-400">💍 Dopo — Durante la cerimonia</CardTitle>
                <p className="text-sm text-gray-400">Riproponete la stessa camminata da sposati, mano nella mano</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <input type="file" accept="video/*" capture="environment"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setAfterFile(f); setAfterPreview(URL.createObjectURL(f)); } }}
                  className="text-sm w-full text-gray-300" />
                {afterPreview && (
                  <video src={afterPreview} className="w-full rounded-lg" controls />
                )}
                <Button className="w-full" disabled={!afterFile || uploading === 'after'}
                  onClick={() => handleUpload('after')}>
                  {uploading === 'after' ? 'Caricamento...' : videoAfter ? 'Ricarica' : 'Carica video'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {mode === 'view' && videoBefore && videoAfter && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <div className="text-6xl mb-2">🔥</div>
              <h2 className="text-2xl font-bold text-amber-400">Dal primo passo... al SI!</h2>
              <p className="text-gray-400">Due momenti, una storia. Premi play e vivi l'emozione.</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={toggleSync} size="lg" className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8">
                  {synced ? '⏸ Pausa' : '▶ Riproduci insieme'}
                </Button>
                <Button variant="outline" onClick={handleReset} className="text-gray-400">
                  Ricarica video
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl overflow-hidden shadow-2xl shadow-amber-500/20">
              <div className="relative bg-gray-900">
                <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-black/60 text-amber-400 text-xs font-semibold backdrop-blur-sm">
                  📱 Prima
                </div>
                <video ref={video1Ref} src={videoBefore} className="w-full aspect-[9/16] object-cover" onTimeUpdate={handleVideo1Time} />
              </div>
              <div className="relative bg-gray-900">
                <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-full bg-black/60 text-amber-400 text-xs font-semibold backdrop-blur-sm">
                  💍 Dopo
                </div>
                <video ref={video2Ref} src={videoAfter} className="w-full aspect-[9/16] object-cover" />
              </div>
            </div>

            <div className="text-center text-sm text-gray-500 space-y-1">
              <p>📱 Suggerimento: condividi questo schermo o registra con un screen recorder per un video unico</p>
              <p className="text-xs opacity-50">I video vengono sincronizzati automaticamente quando premi "Riproduci insieme"</p>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center mt-4">{error}</p>}
      </div>
    </main>
  );
}
