'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

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

// Beep udibile durante il conto alla rovescia (3-2-1), niente asset audio da caricare.
function playBeep(freq = 880, durationMs = 120) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, durationMs);
  } catch { /* audio non disponibile, ignora */ }
}

export function VideoRecorder({ onRecordingComplete, maxDuration = 30, suggestedText }: VideoRecorderProps) {
  const [state, setState] = useState<'idle' | 'countdown' | 'recording' | 'preview'>('idle');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout>(undefined);
  const countdownRef = useRef<NodeJS.Timeout>(undefined);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  // Rilascia sempre la fotocamera allo smontaggio (evita che resti "accesa" su iOS/Android).
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(timerRef.current);
    clearInterval(countdownRef.current);
  }, []);

  const beginRecordingOnStream = useCallback((stream: MediaStream, mime: string) => {
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
  }, [maxDuration]);

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

      // Conto alla rovescia (3-2-1) con beep prima di far partire davvero la registrazione,
      // così l'ospite ha il tempo di inquadrarsi ed è chiaro quando parte.
      setState('countdown');
      let n = 3;
      setCountdown(n);
      playBeep();
      countdownRef.current = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(countdownRef.current);
          playBeep(1200, 180);
          beginRecordingOnStream(stream, mime);
        } else {
          setCountdown(n);
          playBeep();
        }
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
  }, [maxDuration, beginRecordingOnStream]);

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
    clearInterval(countdownRef.current);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
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

  const isFullscreen = state !== 'idle';

  return (
    <div className="space-y-3">
      {!isFullscreen && (
        <div className="flex flex-col items-center gap-2 py-6">
          {!unsupported && (
            <Button size="lg" className="px-8" onClick={startRecording}>Registra video</Button>
          )}
          {unsupported && (
            <p className="text-xs text-text-muted text-center max-w-xs">
              Registrazione live non disponibile su questo browser: carica un video dalla galleria.
            </p>
          )}
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            Carica video dalla galleria
          </Button>
        </div>
      )}

      {/* La fotocamera si apre a schermo intero durante conto alla rovescia/registrazione/anteprima
          — prima era confinata in un riquadro piccolo (aspect-[4/3]), scomodo per inquadrarsi. */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <button
            onClick={reset}
            className="absolute top-4 left-4 z-20 bg-black/60 text-white rounded-full p-2"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative flex-1 min-h-0">
            {/* muted only during idle/recording (avoids mic feedback from the live camera preview) —
                during 'preview' the same <video> plays back the recorded blob and must NOT be muted,
                otherwise guests always see the review silent even though audio was captured fine. */}
            <video
              ref={videoRef}
              autoPlay
              muted={state !== 'preview'}
              controls={state === 'preview'}
              playsInline
              className="w-full h-full object-contain"
            />

            {state === 'recording' && (
              <>
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 text-white px-3 py-1 rounded-full text-sm z-10">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                  {timeLeft}s
                </div>
                {suggestedText && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-sm p-4 text-center leading-relaxed max-h-32 overflow-y-auto pointer-events-none">
                    {suggestedText}
                  </div>
                )}
              </>
            )}

            {state === 'countdown' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10 pointer-events-none">
                <span key={countdown} className="text-white text-9xl font-bold drop-shadow-lg animate-pulse">{countdown}</span>
              </div>
            )}

            {/* pointer-events-none: senza questo l'etichetta "Anteprima" copriva i controlli nativi
                del video e il tocco su play/pausa/scrubber non arrivava mai al player — l'anteprima
                sembrava "non rivedibile" anche se il video c'era ed era corretto. */}
            {state === 'preview' && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
                <span className="text-white/80 text-sm bg-black/40 px-3 py-1 rounded-full">Anteprima — rivedi il tuo video</span>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3 p-4 bg-black/80 z-20">
            {state === 'recording' && <Button variant="destructive" size="lg" onClick={stopRecording}>Ferma</Button>}
            {state === 'preview' && (
              <>
                <Button size="lg" onClick={confirmAndSend}>Invia messaggio</Button>
                <Button variant="outline" size="lg" onClick={startRecording}>Riprova</Button>
              </>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        capture="user"
        className="hidden"
        onChange={handleFileFallback}
      />
    </div>
  );
}
