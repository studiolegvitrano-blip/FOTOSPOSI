'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getEventByCode } from '@fotosposi/events';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Camera, Video } from 'lucide-react';

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, coupleName?: string, eventDate?: string) {
  ctx.save();
  // Sfondo semitrasparente in basso
  const barH = 80;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, h - barH, w, barH);

  // Nome coppia + "Sposi"  es. "Marco & Giulia Sposi"
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = 'bold 26px Georgia, "Times New Roman", serif';
  ctx.fillText(`${coupleName || 'Gli Sposi'} Sposi`, w / 2, h - 40);

  // Data evento  es. "02/07/2026"
  ctx.font = '15px Georgia, "Times New Roman", serif';
  ctx.textBaseline = 'bottom';
  ctx.fillText(eventDate || '', w / 2, h - 14);

  // Brand FotoSposi in alto a destra
  ctx.globalAlpha = 0.35;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('FotoSposi', w - 12, 12);
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise(resolve => canvas.toBlob(b => resolve(b ?? new Blob()), 'image/jpeg', 0.92));
}

export default function KioskPage() {
  const t = useTranslations('kiosk');
  const c = useTranslations('common');
  const params = useParams();
  const code = params.code as string;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const rafRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [eventName, setEventName] = useState('');
  const [coupleName, setCoupleName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [step, setStep] = useState<'intro' | 'camera' | 'preview' | 'done'>('intro');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [countingDown, setCountingDown] = useState(false);
  const [recording, setRecording] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    getEventByCode(code).then(r => {
      if (r.event) {
        setEventId(r.event.id);
        setEventName(r.event.couple_name || 'Evento');
        setCoupleName(r.event.couple_name || '');
        const d = new Date(r.event.date);
        setEventDate(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`);
      }
    });
  }, [code]);

  const stopStream = () => {
    cancelAnimationFrame(rafRef.current);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(t => t.stop());
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: mode === 'video',
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStep('camera');
    } catch { setError(c('error_generic')); }
  };

  const doCountdown = (cb: () => void) => {
    setCountingDown(true);
    let sec = 3;
    const timer = setInterval(() => {
      sec--;
      if (sec <= 0) {
        clearInterval(timer);
        setCountingDown(false);
        cb();
      }
    }, 1000);
  };

  // ------- PHOTO -------
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    doCountdown(() => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      drawWatermark(ctx, canvas.width, canvas.height, coupleName, eventDate);
      canvasToBlob(canvas).then(blob => {
        setMediaBlob(blob);
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
        autoSave(url, 'jpg');
        if (eventId && guestName.trim()) autoUpload(blob, eventId, guestName, 'image/jpeg', 'jpg');
        setStep('preview');
      });
      stopStream();
    });
  };

  // ------- VIDEO -------
  const startVideoRecording = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    doCountdown(() => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const stream = videoRef.current?.srcObject as MediaStream | null;
      drawFrames(ctx, canvas, video);
      const canvasStream = canvas.captureStream(30);
      if (stream?.getAudioTracks().length) stream.getAudioTracks().forEach(t => canvasStream.addTrack(t.clone()));

      chunksRef.current = [];
      const recorder = new MediaRecorder(canvasStream, { mimeType: 'video/webm;codecs=vp9,opus' });
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        cancelAnimationFrame(rafRef.current);
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setMediaBlob(blob);
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
        autoSave(url, 'webm');
        if (eventId && guestName.trim()) autoUpload(blob, eventId, guestName, 'video/webm', 'webm');
        setRecording(false);
        setStep('preview');
        stopStream();
      };
      recorder.start();
      setRecording(true);
    });
  };

  const stopVideoRecording = () => recorderRef.current?.stop();

  function drawFrames(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, video: HTMLVideoElement) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawWatermark(ctx, canvas.width, canvas.height, coupleName, eventDate);
    rafRef.current = requestAnimationFrame(() => drawFrames(ctx, canvas, video));
  }

  // ------- COMMON -------
  const autoSave = (url: string, ext: string) => {
    if (downloadRef.current) {
      downloadRef.current.href = url;
      downloadRef.current.download = `fotosposi_${Date.now()}.${ext}`;
      downloadRef.current.click();
    }
  };

  const autoUpload = async (blob: Blob, eid: string, name: string, contentType: string, ext: string) => {
    const filename = `kiosk_${name.replace(/\s+/g, '_')}_${Date.now()}.${ext}`;
    try {
      const r2Resp = await fetch('/api/r2/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, contentType, prefix: `kiosk/${eid}`, fileSize: blob.size }),
      });
      const r2Data = await r2Resp.json();
      if (!r2Resp.ok || !r2Data.presignedUrl) return;
      await fetch(r2Data.presignedUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
      setCount(prev => prev + 1);
    } catch {}
  };

  const retake = () => { setMediaUrl(null); setMediaBlob(null); stopStream(); startCamera(); };

  const cleanup = () => { setMediaUrl(null); setMediaBlob(null); stopStream(); setStep('intro'); };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <a ref={downloadRef} className="hidden" />

      <div className="text-center mb-6">
        <div className="text-2xl font-bold text-amber-400">{c('brand_name')}</div>
        <p className="text-lg text-gray-300">{eventName}</p>
      </div>

      {step === 'intro' && (
        <Card className="w-full max-w-md bg-gray-900 border-gray-700 text-white">
          <CardHeader><CardTitle className="text-center">{t('title')}</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-6xl">🤳</p>
            <p className="text-gray-300">{t('instructions')}</p>
            <div className="flex gap-2 justify-center">
              <Button variant={mode === 'photo' ? 'default' : 'outline'} size="sm" onClick={() => setMode('photo')}>
                <Camera className="w-4 h-4 mr-1" /> Foto
              </Button>
              <Button variant={mode === 'video' ? 'default' : 'outline'} size="sm" onClick={() => setMode('video')}>
                <Video className="w-4 h-4 mr-1" /> Video
              </Button>
            </div>
            <input value={guestName} onChange={e => setGuestName(e.target.value)}
              placeholder="Il tuo nome"
              className="w-full rounded-md bg-gray-800 border border-gray-600 px-3 py-2 text-white text-center" />
            <Button className="w-full" onClick={startCamera} disabled={!guestName.trim()}>
              {c('next')}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'camera' && (
        <div className="relative w-full max-w-md">
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg" style={{ transform: 'scaleX(-1)' }} />
          {countingDown && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-8xl font-bold text-amber-400 animate-ping">3</div>
            </div>
          )}
          <div className="flex gap-3 justify-center mt-4">
            {mode === 'photo' ? (
              <Button onClick={capturePhoto} size="lg" className="px-8" disabled={countingDown}>
                {countingDown ? '3...' : t('capture')}
              </Button>
            ) : !recording ? (
              <Button onClick={startVideoRecording} size="lg" className="px-8" disabled={countingDown}>
                {countingDown ? '3...' : 'Registra video 10s'}
              </Button>
            ) : (
              <Button onClick={stopVideoRecording} size="lg" variant="destructive" className="px-8 animate-pulse">
                Ferma registrazione
              </Button>
            )}
          </div>
          {recording && <p className="text-center text-sm text-red-400 mt-2 animate-pulse">Registrazione in corso...</p>}
          <div className="text-center mt-2 text-sm text-gray-500">
            <p>{c('gallery')}: {count}</p>
          </div>
        </div>
      )}

      {step === 'preview' && mediaUrl && (
        <div className="w-full max-w-md space-y-4">
          {mode === 'photo' ? (
            <img src={mediaUrl} alt="" className="w-full rounded-lg" />
          ) : (
            <video ref={previewRef} src={mediaUrl} controls autoPlay className="w-full rounded-lg" />
          )}
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={retake}>{t('retake')}</Button>
            <Button variant="outline" onClick={cleanup}>Nuovo {mode === 'photo' ? 'selfie' : 'video'}</Button>
          </div>
          <p className="text-xs text-gray-500 text-center">
            {mode === 'photo' ? 'Foto' : 'Video'} salvato con logo FotoSposi
          </p>
        </div>
      )}

      {step === 'done' && (
        <Card className="w-full max-w-md bg-gray-900 border-gray-700 text-white">
          <CardContent className="text-center space-y-4 py-8">
            <div className="text-6xl">🎉</div>
            <p className="text-xl">Grazie, {guestName}!</p>
            <p className="text-gray-400">{t('success')}</p>
            <Button onClick={cleanup}>Un altro {mode === 'photo' ? 'selfie' : 'video'}</Button>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
    </main>
  );
}
