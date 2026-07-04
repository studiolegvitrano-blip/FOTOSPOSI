'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getEventByCode } from '@fotosposi/events';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Camera, Video, Upload } from 'lucide-react';

function brandName(): string {
  if (typeof window !== 'undefined' && window.location.hostname.includes('justmarry')) return 'JustMarry.live';
  return 'Sposi.live';
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, coupleName?: string, eventDate?: string) {
  ctx.save();
  const barH = Math.max(160, Math.round(h / 6));
  const fontSizeName = Math.max(44, Math.round(w / 11));
  const fontSizeDate = Math.max(32, Math.round(w / 16));

  // Sfondo con gradiente in basso
  const grad = ctx.createLinearGradient(0, h - barH, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0.0)');
  grad.addColorStop(0.3, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - barH, w, barH);

  // Nome coppia
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `bold ${fontSizeName}px Georgia, "Times New Roman", serif`;
  ctx.fillText(`${coupleName || 'Gli Sposi'}`, w / 2, h - barH + Math.round(barH * 0.38));

  // Data evento
  ctx.font = `${fontSizeDate}px Georgia, "Times New Roman", serif`;
  ctx.fillText(eventDate || '', w / 2, h - barH + Math.round(barH * 0.38) + fontSizeName + 6);

  // Brand in basso a destra (sopra la barra)
  ctx.globalAlpha = 0.50;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = `${Math.max(24, Math.round(w / 22))}px Georgia, sans-serif`;
  ctx.fillText(brandName(), w - 16, h - 16);
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise(resolve => canvas.toBlob(b => resolve(b ?? new Blob()), 'image/jpeg', 0.92));
}

// iOS Safari does not support 'video/webm' (throws NotSupportedError on `new MediaRecorder`).
// Feature-detect a supported mimeType instead of hardcoding webm, so recording also works on
// iPhone/iPad (Safari) and Android WebViews that only support mp4/h264.
function pickSupportedVideoMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];
  return candidates.find(m => MediaRecorder.isTypeSupported(m));
}

function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function extFromMime(mime: string): string {
  return mime.includes('mp4') ? 'mp4' : 'webm';
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
  const uploadRef = useRef<HTMLInputElement>(null);

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

  // Rilascia sempre la fotocamera quando il componente si smonta (evita che resti
  // "accesa" su iOS/Android se l'ospite naviga via mentre la preview è attiva).
  useEffect(() => stopStream, []);

  const startCamera = async () => {
    if (!cameraSupported()) {
      setError('Fotocamera non disponibile su questo browser. Usa "Carica foto" per inviare uno scatto dalla galleria.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: mode === 'video',
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStep('camera');
      setError('');
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Permesso fotocamera negato. Abilita fotocamera e microfono nelle impostazioni del browser, oppure usa "Carica foto".');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('Nessuna fotocamera trovata su questo dispositivo. Usa "Carica foto".');
      } else {
        setError(c('error_generic'));
      }
    }
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

  // ------- PHOTO (watermark su tutto) -------
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

  // ------- VIDEO (watermark su tutto via canvas.captureStream) -------
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
      if (stream?.getAudioTracks().length) canvasStream.addTrack(stream.getAudioTracks()[0]!.clone());

      chunksRef.current = [];
      const mime = pickSupportedVideoMime();
      if (!mime) {
        setError('Registrazione video non supportata su questo browser. Usa "Carica foto" per inviare un video dalla galleria.');
        stopStream();
        return;
      }
      const recorder = new MediaRecorder(canvasStream, { mimeType: mime });
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        cancelAnimationFrame(rafRef.current);
        const ext = extFromMime(mime);
        const blob = new Blob(chunksRef.current, { type: mime });
        setMediaBlob(blob);
        const url = URL.createObjectURL(blob);
        setMediaUrl(url);
        autoSave(url, ext);
        if (eventId && guestName.trim()) autoUpload(blob, eventId, guestName, mime, ext);
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
      downloadRef.current.download = `${brandName().toLowerCase().replace(/[^a-z0-9]/g,'')}_${Date.now()}.${ext}`;
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

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !eventId || !guestName.trim()) return;
    const contentType = file.type || 'image/jpeg';
    const ext = contentType.includes('video') ? 'webm' : 'jpg';
    const blob = file;
    if (contentType.startsWith('image/')) {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.onload = async () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) { ctx.drawImage(img, 0, 0); drawWatermark(ctx, canvas.width, canvas.height, coupleName, eventDate); }
        canvas.toBlob(async (b) => { if (b) await autoUpload(b, eventId, guestName, 'image/jpeg', 'jpg'); }, 'image/jpeg', 0.92);
      };
      img.src = URL.createObjectURL(blob);
    } else {
      await autoUpload(blob, eventId, guestName, contentType, ext);
    }
    setStep('done');
    if (uploadRef.current) uploadRef.current.value = '';
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
            <Camera className="w-16 h-16 mx-auto text-amber-400" />
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
            <div className="pt-2">
              <Button variant="outline" className="w-full" onClick={() => uploadRef.current?.click()} disabled={!guestName.trim()}>
                <Upload className="w-4 h-4 mr-2" /> Carica foto
              </Button>
            </div>
            <input ref={uploadRef} type="file" accept="image/*,video/*" onChange={handleUploadFile} className="hidden" />
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
            <Button variant="outline" size="sm" className="mt-2" onClick={() => uploadRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Carica foto
            </Button>
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
            {mode === 'photo' ? 'Foto' : 'Video'} salvato con logo {brandName()}
          </p>
        </div>
      )}

      {step === 'done' && (
        <Card className="w-full max-w-md bg-gray-900 border-gray-700 text-white">
          <CardContent className="text-center space-y-4 py-8">
            <Camera className="w-16 h-16 mx-auto text-amber-400" />
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
