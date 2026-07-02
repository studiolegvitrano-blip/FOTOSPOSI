'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getEventByCode } from '@fotosposi/events';
import { uploadToStorage, compressImage } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function KioskPage() {
  const t = useTranslations('kiosk');
  const c = useTranslations('common');
  const params = useParams();
  const code = params.code as string;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [eventName, setEventName] = useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [step, setStep] = useState<'intro' | 'camera' | 'preview' | 'done'>('intro');
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    getEventByCode(code).then(r => {
      if (r.event) {
        setEventId(r.event.id);
        setEventName(r.event.couple_name || 'Evento');
      }
    });
  }, [code]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStep('camera');
    } catch {
      setError(c('error_generic'));
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setPhoto(dataUrl);
            setStep('preview');
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const retake = () => {
    setPhoto(null);
    setStep('camera');
  };

  const savePhoto = async () => {
    if (!photo || !eventId || !guestName.trim()) { setError('Inserisci il tuo nome'); return; }
    setUploading(true);
    setError('');
    try {
      const res = await fetch(photo);
      const blob = await res.blob();
      const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const compressed = await compressImage(file, 2048);
      const path = `kiosk/${eventId}/${guestName.replace(/\s+/g, '_')}_${Date.now()}.jpg`;
      const { url, error: uploadErr } = await uploadToStorage('media', path, compressed);
      if (uploadErr) { setError(uploadErr); return; }
      setGuestToken(guestName);
      setStep('done');
      setCount(prev => prev + 1);
    } catch (e: any) { setError(e.message); }
    setUploading(false);
  };

  const takeAnother = () => {
    setPhoto(null);
    setStep('camera');
    startCamera();
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
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
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg" style={{ transform: 'scaleX(-1)' }} />
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-8xl font-bold text-amber-400 animate-ping">{countdown}</div>
            </div>
          )}
          <div className="flex gap-3 justify-center mt-4">
            <Button onClick={capturePhoto} size="lg" className="px-8">
              {countdown !== null ? `${countdown}...` : t('capture')}
            </Button>
          </div>
          <div className="text-center mt-2 text-sm text-gray-500">
            <p>{c('gallery')}: {count}</p>
          </div>
        </div>
      )}

      {step === 'preview' && photo && (
        <div className="w-full max-w-md space-y-4">
          <img src={photo} alt="" className="w-full rounded-lg" />
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={retake}>{t('retake')}</Button>
            <Button onClick={savePhoto} disabled={uploading}>
              {uploading ? t('uploading') : c('save')}
            </Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <Card className="w-full max-w-md bg-gray-900 border-gray-700 text-white">
          <CardContent className="text-center space-y-4 py-8">
            <div className="text-6xl">🎉</div>
            <p className="text-xl">Grazie, {guestName}!</p>
            <p className="text-gray-400">{t('success')}</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={takeAnother}>Un altro selfie</Button>
              <Button variant="outline" asChild>
                <Link href={`/event/${code}`}>{c('back')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
    </main>
  );
}
