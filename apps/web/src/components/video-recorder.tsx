'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
  suggestedText?: string;
}

// iOS Safari does not support 'video/webm' — hardcoding it makes `new MediaRecorder(...)`
// throw immediately on iPhone/iPad. Feature-detect a supported mimeType instead, with an
// mp4/h264 fallback for Safari.
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

export function VideoRecorder({ onRecordingComplete, maxDuration = 30, suggestedText }: VideoRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout>(undefined);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  // Rilascia sempre la fotocamera allo smontaggio (evita che resti "accesa" su iOS/Android).
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(timerRef.current);
  }, []);

  const startRecording = useCallback(async () => {
    if (!cameraSupported()) {
      setUnsupported(true);
      return;
    }
    const mime = pickSupportedVideoMime();
    if (!mime) {
      setUnsupported(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        setRecordedBlob(blob);
        setState('preview');
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = URL.createObjectURL(blob);
        }
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setState('recording');
      setTimeLeft(maxDuration);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        alert('Permesso fotocamera/microfono negato. Abilitalo nelle impostazioni del browser per registrare un video.');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        alert('Nessuna fotocamera trovata su questo dispositivo.');
      } else {
        alert('Impossibile accedere alla fotocamera. Controlla i permessi.');
      }
    }
  }, [maxDuration]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
  }, []);

  const confirmAndSend = useCallback(() => {
    if (recordedBlob) {
      onRecordingComplete(recordedBlob);
    }
  }, [recordedBlob, onRecordingComplete]);

  const reset = useCallback(() => {
    setState('idle');
    setTimeLeft(maxDuration);
    setRecordedBlob(null);
    setUnsupported(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
  }, [maxDuration]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileFallback = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecordedBlob(file);
    setState('preview');
    if (videoRef.current) videoRef.current.src = URL.createObjectURL(file);
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
        {/* muted only during idle/recording (avoids mic feedback from the live camera preview) —
            during 'preview' the same <video> plays back the recorded blob and must NOT be muted,
            otherwise guests always see the review silent even though audio was captured fine. */}
        <video ref={videoRef} autoPlay muted={state !== 'preview'} controls={state === 'preview'} playsInline className="w-full h-full object-cover" />
        {state === 'recording' && (
          <>
            <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/60 text-white px-3 py-1 rounded-full text-sm z-10">
              <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
              {timeLeft}s
            </div>
            {suggestedText && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-sm p-4 text-center leading-relaxed max-h-32 overflow-y-auto">
                {suggestedText}
              </div>
            )}
          </>
        )}
        {state === 'preview' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-white/80 text-sm">Anteprima — rivedi il tuo video</span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="flex justify-center gap-2">
          {state === 'idle' && !unsupported && <Button onClick={startRecording}>Registra video</Button>}
          {state === 'recording' && <Button variant="destructive" onClick={stopRecording}>Ferma</Button>}
          {state === 'preview' && (
            <>
              <Button onClick={confirmAndSend}>Invia messaggio</Button>
              <Button variant="outline" onClick={reset}>Riprova</Button>
            </>
          )}
        </div>
        {state === 'idle' && (
          <>
            {unsupported && (
              <p className="text-xs text-text-muted text-center max-w-xs">
                Registrazione live non disponibile su questo browser: carica un video dalla galleria.
              </p>
            )}
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Carica video dalla galleria
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              capture="user"
              className="hidden"
              onChange={handleFileFallback}
            />
          </>
        )}
      </div>
    </div>
  );
}
