'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface VideoRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  maxDuration?: number;
  suggestedText?: string;
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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
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
    } catch {
      alert('Impossibile accedere alla fotocamera. Controlla i permessi.');
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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
  }, [maxDuration]);

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg overflow-hidden bg-black aspect-[4/3]">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
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
      <div className="flex justify-center gap-2">
        {state === 'idle' && <Button onClick={startRecording}>Registra video</Button>}
        {state === 'recording' && <Button variant="destructive" onClick={stopRecording}>Ferma</Button>}
        {state === 'preview' && (
          <>
            <Button onClick={confirmAndSend}>Invia messaggio</Button>
            <Button variant="outline" onClick={reset}>Riprova</Button>
          </>
        )}
      </div>
    </div>
  );
}
