'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createMediaRecord, enqueueUpload, getPendingQueue, updateQueueItem, getQueueStats, compressImage, type QueueItem } from '@fotosposi/media';
import { getCurrentUser, getEventTier, type Tier } from '@fotosposi/core';
import { getEventById, getEventWindow } from '@fotosposi/events';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Upload, Image, Video, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

export default function UploadPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [phase, setPhase] = useState<'idle' | 'queueing' | 'processing'>('idle');
  const [stats, setStats] = useState({ pending: 0, processing: 0, synced: 0, failed: 0 });
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0 });
  const [eventReady, setEventReady] = useState(false);
  const [tier, setTier] = useState<Tier>('free');
  const [skipVideos, setSkipVideos] = useState(0);
  const [limitReached, setLimitReached] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const FREE_MAX_PHOTOS = 100;

  const [eventMeta, setEventMeta] = useState<{ couple_name: string; date: string } | null>(null);

  function applyWatermark(blob: Blob, coupleName: string, eventDate: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(blob); return; }
        ctx.drawImage(img, 0, 0);
        const h = canvas.height;
        const w = canvas.width;
        const barH = Math.max(160, Math.round(h / 6));
        const fontSizeName = Math.max(44, Math.round(w / 11));
        const fontSizeDate = Math.max(32, Math.round(w / 16));
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, h - barH, w, barH);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = `bold ${fontSizeName}px Georgia, serif`;
        ctx.fillText(coupleName, w / 2, h - barH + Math.round(barH * 0.38));
        ctx.font = `${fontSizeDate}px Georgia, serif`;
        ctx.fillText(eventDate, w / 2, h - barH + Math.round(barH * 0.38) + fontSizeName + 6);
        ctx.font = `${Math.max(24, Math.round(w / 22))}px Georgia, serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.textAlign = 'right';
        ctx.fillText((typeof window !== 'undefined' && window.location.hostname.includes('justmarry') ? 'JustMarry.live' : 'Sposi.live'), w - 12, 28);
        ctx.restore();
        canvas.toBlob(b => { if (b) resolve(b); else resolve(blob); }, blob.type, 0.92);
      };
      img.onerror = () => resolve(blob);
      img.src = URL.createObjectURL(blob);
    });
  }

  const loadQueue = useCallback(async () => {
    const { items } = await getPendingQueue(eventId);
    if (items) {
      setQueue(items);
      const s = await getQueueStats(eventId);
      setStats(s);
      if (items.some(i => i.status === 'pending' || i.status === 'failed')) {
        setPhase('processing');
        return true;
      }
      if (s.synced + s.failed === s.pending + s.processing + s.synced + s.failed && s.synced + s.failed > 0) {
        setPhase('idle');
      }
    }
    return false;
  }, [eventId]);

  const triggerServerProcessing = async () => {
    await fetch('/api/r2/process-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
  };

  useEffect(() => {
    const init = async () => {
      const { user } = await getCurrentUser();
      if (!user) { router.push('/login'); return; }
      const { event } = await getEventById(eventId);
      if (!event) return;
      setEventMeta({ couple_name: event.couple_name, date: event.date });
      const isCreator = event.created_by === user.id;
      if (!isCreator) {
        const { window: w } = await getEventWindow(eventId);
        if (w) {
          const now = new Date();
          if (now < new Date(w.opens_at) || now > new Date(w.closes_at)) {
            router.push(`/events/${eventId}`);
            return;
          }
        }
      }
      const { tier: evTier } = await getEventTier(eventId);
      if (evTier) setTier(evTier);
      if (evTier === 'free') {
        const s = await getQueueStats(eventId);
        const totalExisting = s.synced + s.pending + s.processing;
        if (totalExisting >= FREE_MAX_PHOTOS) setLimitReached(true);
      }
      setEventReady(true);
      const hasPending = await loadQueue();
      if (hasPending) {
        triggerServerProcessing();
        pollRef.current = setInterval(async () => {
          const stillPending = await loadQueue();
          if (!stillPending) clearInterval(pollRef.current);
        }, 3000);
      }
    };
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [eventId, router, loadQueue]);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const stillPending = await loadQueue();
      if (!stillPending) { clearInterval(pollRef.current); pollRef.current = undefined; }
    }, 3000);
  };

  const processFiles = async (selected: FileList) => {
    const { user } = await getCurrentUser();
    if (!user || !selected.length) return;

    const isFree = tier === 'free';
    let skippedVideos = 0;
    let reachedLimit = false;

    const files: File[] = [];
    for (let i = 0; i < selected.length; i++) {
      const f = selected.item(i);
      if (!f) continue;
      if (isFree && f.type.startsWith('video/')) { skippedVideos++; continue; }
      files.push(f);
    }
    setSkipVideos(skippedVideos);

    const s = await getQueueStats(eventId);
    const totalExisting = s.synced + s.pending + s.processing;
    const slotsLeft = isFree ? Math.max(0, FREE_MAX_PHOTOS - totalExisting) : files.length;
    const allowed = files.slice(0, slotsLeft);
    if (allowed.length < files.length) reachedLimit = true;
    setLimitReached(reachedLimit);
    if (allowed.length === 0) { setPhase('idle'); return; }

    setPhase('queueing');
    setQueueProgress({ current: 0, total: allowed.length });
    let queued = 0;

    for (let i = 0; i < allowed.length; i++) {
      const file = allowed[i]!;
      setQueueProgress({ current: i + 1, total: allowed.length });

      let uploadFile: Blob | File = file;
      let compressed = false;

      if (file.type.startsWith('image/')) {
        if (isFree) {
          try { uploadFile = await compressImage(file, 1200); compressed = true; } catch { }
        }
        if (eventMeta) {
          try { uploadFile = await applyWatermark(uploadFile, eventMeta.couple_name, eventMeta.date); } catch { }
        }
      }

      const { id, error } = await enqueueUpload({
        event_id: eventId,
        uploaded_by: user.id,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: uploadFile.size,
        compressed,
      });
      if (error || !id) continue;

      const prefix = `events/${eventId}`;
      const r2Resp = await fetch('/api/r2/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, prefix }),
      });
      const r2Data = await r2Resp.json();
      if (!r2Resp.ok || !r2Data.presignedUrl) {
        await updateQueueItem(id, { status: 'failed', error: r2Data.error || 'Presigned URL fallita' });
        continue;
      }

      const uploadResp = await fetch(r2Data.presignedUrl, {
        method: 'PUT',
        body: uploadFile,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadResp.ok) {
        await updateQueueItem(id, { status: 'failed', error: 'Upload R2 fallito' });
        continue;
      }
      await updateQueueItem(id, { r2_key: r2Data.key });
      queued++;
      setQueue(prev => [...prev, {
        id, event_id: eventId, uploaded_by: user.id,
        file_name: file.name, file_type: file.type, file_size: uploadFile.size,
        status: 'pending' as const, storage_path: null, compressed_path: null, drive_file_id: null,
        error: null, retry_count: 0, compressed, created_at: new Date().toISOString(), processed_at: null, r2_key: r2Data.key,
      } as QueueItem]);
    }
    setStats(prev => ({ ...prev, pending: prev.pending + queued }));
    setPhase('processing');
    if (inputRef.current) inputRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';

    triggerServerProcessing();
    startPolling();
  };

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
  };

  if (!eventReady) return (
    <main className="max-w-2xl mx-auto p-4 flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-6 h-6 animate-spin text-brand" />
    </main>
  );

  const allDone = phase === 'idle' && (stats.synced + stats.failed) > 0 && stats.pending + stats.processing === 0;

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Carica foto e video</h1>
        <p className="text-text-muted text-sm mt-1">
          Seleziona file dal telefono o scatta direttamente con la fotocamera.
        </p>
      </div>

      {tier === 'free' && (
        <Card className="border-error/30 bg-error/5">
          <CardContent className="py-3 text-sm text-error">
            <strong>Piano Free</strong> — max {FREE_MAX_PHOTOS} foto compresse. Nessun video.
            <Button variant="link" className="text-brand p-0 h-auto ml-1" asChild>
              <a href={`/events/${eventId}/tier`}>Passa a Premium</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {limitReached && (
        <Card className="border-error/30 bg-error/5">
          <CardContent className="py-3 text-sm text-error">
            Hai raggiunto il limite di {FREE_MAX_PHOTOS} foto del piano Free.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card className="hover:border-brand/50 transition-colors cursor-pointer" onClick={() => inputRef.current?.click()}>
          <CardContent className="py-8 text-center space-y-2">
            <Image className="w-8 h-8 mx-auto text-brand" />
            <p className="font-medium">Galleria</p>
            <p className="text-xs text-text-muted">Scegli foto e video dal telefono</p>
          </CardContent>
        </Card>
        <Card className="hover:border-brand/50 transition-colors cursor-pointer" onClick={() => cameraRef.current?.click()}>
          <CardContent className="py-8 text-center space-y-2">
            <Camera className="w-8 h-8 mx-auto text-brand" />
            <p className="font-medium">Fotocamera</p>
            <p className="text-xs text-text-muted">Scatta una foto ora</p>
          </CardContent>
        </Card>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={tier === 'free' ? 'image/*' : 'image/*,video/*'}
        onChange={handleSelectFiles}
        disabled={phase === 'queueing' || phase === 'processing'}
        className="hidden"
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleSelectFiles}
        disabled={phase === 'queueing' || phase === 'processing'}
        className="hidden"
      />

      {phase === 'queueing' && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Accodamento file... {queueProgress.current}/{queueProgress.total}
          </CardContent>
        </Card>
      )}

      {skipVideos > 0 && (
        <p className="text-sm text-error">{skipVideos} video saltati (non disponibili nel piano Free).</p>
      )}

      {(stats.synced + stats.failed + stats.pending + stats.processing > 0) && (
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1 text-success"><CheckCircle2 className="w-4 h-4" /> {stats.synced}</span>
          <span className="flex items-center gap-1 text-error"><XCircle className="w-4 h-4" /> {stats.failed}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-4 h-4" /> {stats.pending + stats.processing}</span>
        </div>
      )}

      {queue.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Coda file</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-72 overflow-y-auto">
            {queue.map(item => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                {item.status === 'synced' ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" /> :
                 item.status === 'failed' ? <XCircle className="w-4 h-4 text-error shrink-0" /> :
                 item.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin text-brand shrink-0" /> :
                 <Clock className="w-4 h-4 text-muted-foreground shrink-0" />}
                <span className="flex-1 truncate">{item.file_name}</span>
                <span className="text-muted-foreground text-xs">{(item.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                <Badge variant={item.status === 'synced' ? 'default' : item.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                  {item.status === 'synced' ? 'Fatto' : item.status === 'failed' ? `Errore` : item.status === 'processing' ? 'In corso' : 'Attesa'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {phase === 'processing' && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Elaborazione lato server in corso... puoi chiudere la pagina e tornare dopo.
        </p>
      )}

      {allDone && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="py-3 text-sm text-success flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Tutti i file elaborati! {stats.synced} completati{stats.failed > 0 ? `, ${stats.failed} con errori.` : '.'}
          </CardContent>
        </Card>
      )}

      <Button variant="link" asChild>
        <a href={`/events/${eventId}`}>Torna all'evento</a>
      </Button>
    </main>
  );
}
