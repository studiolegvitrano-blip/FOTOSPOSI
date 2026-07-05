'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X, RefreshCw } from 'lucide-react';

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Fotocamera vera a schermo intero per scattare foto (getUserMedia + canvas).
 * Nasce perché `<input type="file" capture="environment">` apre la fotocamera solo
 * sui telefoni: su PC apre il file picker, che non è quello che l'utente si aspetta
 * premendo "Fotocamera". Stesso pattern del VideoRecorder / Tavolo Selfie:
 * lo stream va collegato al <video> in un effect DOPO che il tag è montato.
 */
export function PhotoCapture({ onCapture, onClose }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [shot, setShot] = useState<Blob | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  // Avvia (o riavvia, al cambio camera) lo stream e collegalo al <video> già montato.
  useEffect(() => {
    if (shot) return; // in anteprima scatto la camera è spenta
    let cancelled = false;
    (async () => {
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => { /* autoplay attribute già presente */ });
        }
      } catch {
        if (!cancelled) setError('Fotocamera non disponibile o permesso negato. Controlla i permessi del browser.');
      }
    })();
    return () => { cancelled = true; };
  }, [facing, shot, stopStream]);

  // Spegni sempre la camera allo smontaggio.
  useEffect(() => () => stopStream(), [stopStream]);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(b => {
      if (!b) return;
      setShot(b);
      setShotUrl(URL.createObjectURL(b));
      stopStream();
    }, 'image/jpeg', 0.92);
  }, [stopStream]);

  const retry = useCallback(() => {
    if (shotUrl) URL.revokeObjectURL(shotUrl);
    setShot(null);
    setShotUrl(null);
  }, [shotUrl]);

  const confirm = useCallback(() => {
    if (!shot) return;
    const file = new File([shot], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
    onCapture(file);
    if (shotUrl) URL.revokeObjectURL(shotUrl);
    onClose();
  }, [shot, shotUrl, onCapture, onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <button
        onClick={() => { stopStream(); onClose(); }}
        className="absolute top-4 left-4 z-20 bg-black/60 text-white rounded-full p-2"
        aria-label="Chiudi fotocamera"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="relative flex-1 min-h-0 flex items-center justify-center">
        {error ? (
          <p className="text-white/90 text-center px-8 max-w-sm">{error}</p>
        ) : shotUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={shotUrl} alt="Anteprima scatto" className="w-full h-full object-contain" />
        ) : (
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
        )}

        {!shot && !error && (
          <button
            onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))}
            className="absolute top-4 right-4 z-20 bg-black/60 text-white rounded-full p-2"
            aria-label="Cambia fotocamera"
            title="Cambia fotocamera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 p-5 bg-black/80 z-20">
        {error ? (
          <Button size="lg" variant="outline" onClick={() => { stopStream(); onClose(); }}>Chiudi</Button>
        ) : shot ? (
          <>
            <Button size="lg" onClick={confirm}>Usa questa foto</Button>
            <Button size="lg" variant="outline" onClick={retry}>Riprova</Button>
          </>
        ) : (
          /* Pulsante di scatto grande stile fotocamera del telefono */
          <button
            onClick={takePhoto}
            aria-label="Scatta foto"
            className="w-16 h-16 rounded-full bg-white border-4 border-white/40 shadow-lg active:scale-95 transition-transform"
          />
        )}
      </div>
    </div>
  );
}
