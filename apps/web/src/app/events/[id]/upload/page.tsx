'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { compressImage, type QueueItem } from '@fotosposi/media';
import { getCurrentUser, type Tier } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PhotoCapture } from '@/components/photo-capture';
import { Camera, Upload, Image as ImageIcon, Video, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

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
  const [showCamera, setShowCamera] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const FREE_MAX_PHOTOS = 100;

  // Tutte le operazioni sulla coda passano da /api/queue (server-side, autenticata via
  // cookie): scrivere su upload_queue direttamente dal browser falliva sotto RLS perché
  // il client "service" degradava alla anon key senza sessione (auth.uid() = NULL) →
  // "new row violates row-level security policy for table upload_queue".
  const queueApi = useCallback(async (body: Record<string, unknown>): Promise<Record<string, any> | null> => {
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  // Il watermark (nomi sposi + data + logo Sposi.live) viene applicato UNA sola volta,
  // lato server, durante il processing della coda — non più anche qui nel client, dove
  // creava una seconda banda sovrapposta e rallentava i telefoni.
  const loadQueue = useCallback(async () => {
    const d = await queueApi({ action: 'state', eventId });
    if (d && d.stats) {
      setQueue(d.items ?? []);
      const s = d.stats;
      setStats(s);
      // Solo pending/processing tengono la pagina in "processing": prima bastava un
      // item `failed` (che il server non riuscirà mai a recuperare, es. "r2_key
      // mancante") per bloccare PER SEMPRE la fase e quindi disabilitare gli input
      // file — il tap su "Galleria"/"Fotocamera" non apriva più nulla.
      if ((d.items ?? []).some((i: QueueItem) => i.status === 'pending' || i.status === 'processing')) {
        setPhase('processing');
        return true;
      }
      setPhase('idle');
    }
    return false;
  }, [eventId, queueApi]);

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
      // Passa la pagina corrente come `redirect` così, dopo login/registrazione/conferma email,
      // l'ospite torna qui a caricare le foto invece di finire su /dashboard e perdere l'invito.
      if (!user) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }

      // Init server-side via API route (vedi /api/upload/init). Le vecchie chiamate dirette
      // a getEventById/getEventTier/getEventWindow usavano la chiave anon dal browser, ma la
      // RLS su 'events'/'event_windows' è scoped a created_by → invitati (non-creator) vedono
      // 406 e la pagina resta su <Loader2 /> per sempre. La route service-role valida anche
      // che il caller sia creator o membro del tenant dell'evento.
      const initRes = await fetch(`/api/upload/init?eventId=${encodeURIComponent(eventId)}`);
      if (!initRes.ok) {
        const errBody = await initRes.json().catch(() => ({}));
        const errMsg = errBody.error || `HTTP ${initRes.status}`;
        // Se la finestra è chiusa, la route ritorna 409 con {error, window}: rimando all'evento
        if (initRes.status === 409) {
          router.push(`/events/${eventId}`);
          return;
        }
        // Auth errors: lascia la pagina mostrare Loader2 E log per capire (raro, perché login
        // prima di arrivare qui). Per 'non autorizzato' torno al dashboard.
        if (initRes.status === 401) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
        if (initRes.status === 403) { router.push(`/dashboard`); return; }
        if (initRes.status === 404) { router.push(`/dashboard`); return; }
        // Errori sconosciuti: per ora log in console e lascia la pagina girare (eventReady=false).
        console.error('[upload/init] failed:', initRes.status, errMsg);
        return;
      }
      const initData = await initRes.json();
      setTier((initData.tier as Tier) || 'free');
      if (initData.tier === 'free' && initData.stats) {
        const totalExisting =
          (initData.stats.synced ?? 0) + (initData.stats.pending ?? 0) + (initData.stats.processing ?? 0);
        if (totalExisting >= FREE_MAX_PHOTOS) setLimitReached(true);
      }
      setEventReady(true);
      const hasPending = await loadQueue();
      if (hasPending) {
        triggerServerProcessing();
        pollRef.current = setInterval(async () => {
          // Continua a pingare il server: processQueueForEvent elabora max 5 item/round
          // e ritorna 'remaining>0'. Qui sotto continuiamo a triggerarlo finché loadQueue
          // non vede più pending — oppure fino al prossimo cron maintenance. Vedi
          // stress test 26/07: il problema non era il rate-limit (era già 30/min/IP),
          // era che dopo il PRIMO trigger, polling leggeva 'still pending' ma non
          // inviava nuove richieste → coda viva ma nessuno la elaborava per 20min.
          triggerServerProcessing();
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
    // Continua a triggerare il server finché c'è lavoro: il primo round processoQueueForEvent
    // elabora al massimo 5 item × round, poi ritorna 'remaining>0' per richiedere un altro
    // round. Da solo non basta → serve continuare a pingare /api/r2/process-queue ad ogni
    // tick di poll (3s). Prima quando il polling finiva dopo il primo round, la coda
    // rimaneva viva ma nessuno la elaborava fino al cron (20min).
    triggerServerProcessing();
    const stillPending = await loadQueue();
    if (!stillPending) { clearInterval(pollRef.current); pollRef.current = undefined; }
  }, 3000);
};

  const processFiles = async (selected: FileList | File[]) => {
    const { user } = await getCurrentUser();
    if (!user || !selected.length) return;

    const isFree = tier === 'free';
    let skippedVideos = 0;
    let reachedLimit = false;

    const files: File[] = [];
    for (const f of Array.from(selected as ArrayLike<File>)) {
      if (!f) continue;
      // Riconosci anche file MIME-vuoti via estensione: alcuni browser (Safari su .mov, Chrome
      // su container atipici) lasciano File.type stringa vuota. Lo stress test del 26/07 ha
      // mostrato 0/18 video in upload_queue con questa pagina: ipotesi principale era proprio
      // filtrare i video per .startsWith('video/') che NON matchava type=''.
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const looksLikeVideo = f.type.startsWith('video/') ||
        ['mp4', 'mov', 'webm', 'm4v', 'qt', 'avi', 'mkv'].includes(ext);
      const looksLikeImage = f.type.startsWith('image/') ||
        ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext);
      if (isFree && looksLikeVideo) { skippedVideos++; continue; }
      if (!looksLikeVideo && !looksLikeImage) {
        // File sconosciuto, prova ad accodarlo comunque (il server validatore in /api/r2/upload
        // deciderà; qui non blocchiamo l'utente)
      }
      files.push(f);
    }
    setSkipVideos(skippedVideos);

    const stateData = await queueApi({ action: 'state', eventId });
    const s = stateData?.stats ?? { synced: 0, pending: 0, processing: 0, failed: 0 };
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
      }

      const enq = await queueApi({
        action: 'enqueue',
        eventId,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: uploadFile.size,
        compressed,
      });
      const id: string | undefined = enq?.id;
      // Prima un errore qui veniva ignorato in silenzio (`continue`): l'utente vedeva la
      // barra di caricamento ma il file spariva nel nulla, senza traccia in coda né in galleria.
      if (!id) { alert(`"${file.name}" non accodato: ${enq?.error || 'errore sconosciuto'}`); continue; }

      const prefix = `events/${eventId}`; // fallback prefix lato server resta compatibile (vedi route)
      const r2Resp = await fetch('/api/r2/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, prefix, eventId }),
      });
      const r2Data = await r2Resp.json();
      if (!r2Resp.ok || !r2Data.presignedUrl) {
        // Errore temporaneo (rate limit 429, network, R2 transient) → 'retry', non 'fail':
        // il client non deve marcare un item permanentemente failed quando il problema è
        // solo di rete o di rate-limit (vedi stress test 26/07: 8 foto finite in failed
        // con r2_key NULL che il cron avrebbe potuto recuperare se non filtrate a monte).
        await queueApi({ action: 'retry', id, error: r2Data.error || 'Presigned URL fallita' });
        continue;
      }

      const uploadResp = await fetch(r2Data.presignedUrl, {
        method: 'PUT',
        body: uploadFile,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadResp.ok) {
        await queueApi({ action: 'retry', id, error: `Upload R2 PUT ${uploadResp.status}` });
        continue;
      }
      await queueApi({ action: 'mark', id, r2Key: r2Data.key });
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
            <ImageIcon className="w-8 h-8 mx-auto text-brand" />
            <p className="font-medium">Galleria</p>
            <p className="text-xs text-text-muted">Scegli foto e video dal telefono</p>
          </CardContent>
        </Card>
        {/* Fotocamera vera (getUserMedia): l'input con capture="environment" apre la camera
            solo sui telefoni — su PC apriva il file picker, spiazzando l'utente. Se la camera
            non è disponibile si torna al vecchio input come ripiego. */}
        <Card
          className="hover:border-brand/50 transition-colors cursor-pointer"
          onClick={() => {
            // typeof === 'function' invece del semplice truthy check: TS strict segnala
            // "condition always true" su un riferimento a metodo sempre tipizzato come definito.
            if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') setShowCamera(true);
            else cameraRef.current?.click();
          }}
        >
          <CardContent className="py-8 text-center space-y-2">
            <Camera className="w-8 h-8 mx-auto text-brand" />
            <p className="font-medium">Fotocamera</p>
            <p className="text-xs text-text-muted">Scatta una foto ora</p>
          </CardContent>
        </Card>
      </div>

      {showCamera && (
        <PhotoCapture
          onCapture={(file) => processFiles([file])}
          onClose={() => setShowCamera(false)}
        />
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={tier === 'free' ? 'image/*' : 'image/*,video/*'}
        onChange={handleSelectFiles}
        disabled={phase === 'queueing'}
        className="hidden"
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleSelectFiles}
        disabled={phase === 'queueing'}
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
