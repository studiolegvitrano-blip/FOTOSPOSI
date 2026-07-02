'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { registerForPhotoHunt, getPhotoHuntTasks, ensureDefaultTasks, submitPhotoTask, getPhotoHuntLeaderboard } from '@fotosposi/games';
import { uploadToStorage, compressImage } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PhotoHuntTask, PhotoHuntRegistration } from '@fotosposi/games';

const ROLES = [
  { value: 'amico', label: 'Amico/a degli sposi' },
  { value: 'parente', label: 'Parente' },
  { value: 'collega', label: 'Collega' },
  { value: 'altro', label: 'Altro' },
];

export default function PhotoHuntPage() {
  const params = useParams();
  const eventId = params.id as string;

  const [registration, setRegistration] = useState<PhotoHuntRegistration | null>(null);
  const [guestName, setGuestName] = useState('');
  const [role, setRole] = useState<string>('amico');
  const [guestToken, setGuestToken] = useState('');
  const [tasks, setTasks] = useState<PhotoHuntTask[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [submittingTask, setSubmittingTask] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [submittedTasks, setSubmittedTasks] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'register' | 'tasks' | 'leaderboard'>('register');

  useEffect(() => {
    if (!eventId) return;
    ensureDefaultTasks(eventId);
    getPhotoHuntTasks(eventId).then(r => { if (r.tasks) setTasks(r.tasks); });
    getPhotoHuntLeaderboard(eventId).then(r => { if (r.leaderboard) setLeaderboard(r.leaderboard); });
    const stored = sessionStorage.getItem(`photo_hunt_${eventId}`);
    if (stored) {
      const reg = JSON.parse(stored) as PhotoHuntRegistration;
      setRegistration(reg);
      setTab('tasks');
    }
  }, [eventId]);

  const handleRegister = async () => {
    if (!guestName.trim()) return;
    const token = crypto.randomUUID();
    const r = await registerForPhotoHunt({ event_id: eventId, guest_name: guestName, role: role as any, guest_token: token });
    if (r.registration) {
      setRegistration(r.registration);
      sessionStorage.setItem(`photo_hunt_${eventId}`, JSON.stringify(r.registration));
      setTab('tasks');
    }
    if (r.error) setError(r.error);
  };

  const handleSubmit = async (taskId: string) => {
    if (!mediaFile || !registration) return;
    setSubmittingTask(taskId);
    setUploading(true);
    setError('');
    try {
      const compressed = await compressImage(mediaFile);
      const path = `photo-hunt/${eventId}/${registration.id}/${taskId}_${Date.now()}.jpg`;
      const { url, error: uploadErr } = await uploadToStorage('media', path, compressed);
      if (uploadErr) { setError(uploadErr); return; }
      const { error: submitErr } = await submitPhotoTask({
        event_id: eventId, task_id: taskId, registration_id: registration.id, media_url: url!,
      });
      if (submitErr) { setError(submitErr); return; }
      setSubmittedTasks(prev => new Set(prev).add(taskId));
      setMediaFile(null);
      setMediaPreview('');
      getPhotoHuntLeaderboard(eventId).then(r => { if (r.leaderboard) setLeaderboard(r.leaderboard); });
    } catch (e: any) { setError(e.message); }
    setUploading(false);
    setSubmittingTask(null);
  };

  const handleReset = () => {
    setRegistration(null);
    setGuestName('');
    sessionStorage.removeItem(`photo_hunt_${eventId}`);
    setTab('register');
  };

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caccia alla Foto</h1>
          <p className="text-text-muted text-sm">Completa le missioni fotografiche e scala la classifica!</p>
        </div>
        <Button variant="ghost" asChild><Link href={`/events/${eventId}/games`}>← Giochi</Link></Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant={tab === 'register' ? 'default' : 'outline'} size="sm" onClick={() => setTab('register')} disabled={!!registration}>Iscriviti</Button>
        <Button variant={tab === 'tasks' ? 'default' : 'outline'} size="sm" onClick={() => setTab('tasks')} disabled={!registration}>Missioni</Button>
        <Button variant={tab === 'leaderboard' ? 'default' : 'outline'} size="sm" onClick={() => setTab('leaderboard')}>Classifica</Button>
      </div>

      {tab === 'register' && (
        <Card>
          <CardHeader><CardTitle>Iscriviti alla caccia</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-text-muted">Registrati per ricevere le missioni fotografiche e competere con gli altri invitati!</p>
            <div className="space-y-2">
              <Label>Il tuo nome</Label>
              <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Mario Rossi" />
            </div>
            <div className="space-y-2">
              <Label>Chi sei?</Label>
              <select value={role} onChange={e => setRole(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button onClick={handleRegister} disabled={!guestName.trim()}>Iscriviti</Button>
          </CardFooter>
        </Card>
      )}

      {tab === 'tasks' && registration && (
        <div className="space-y-4">
          <Card className="bg-muted">
            <CardContent className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{registration.guest_name}</p>
                <Badge variant="outline" className="capitalize">{registration.role}</Badge>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-muted">Punteggio</p>
                <p className="text-xl font-bold text-brand">{leaderboard.find(l => l.id === registration.id)?.score || 0}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReset}>Cambia giocatore</Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tasks.map(task => {
              const done = submittedTasks.has(task.id);
              return (
                <Card key={task.id} className={done ? 'border-green-500' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{task.title}</CardTitle>
                      <Badge>{task.points} pt</Badge>
                    </div>
                    {task.description && <p className="text-sm text-text-muted mt-1">{task.description}</p>}
                  </CardHeader>
                  <CardContent>
                    {done ? (
                      <p className="text-sm text-green-600">Completata!</p>
                    ) : (
                      <div className="space-y-2">
                        <input type="file" accept="image/*" capture="environment"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) { setMediaFile(f); setMediaPreview(URL.createObjectURL(f)); }
                          }}
                          className="text-sm w-full" />
                        {mediaPreview && <img src={mediaPreview} alt="" className="w-full h-32 object-cover rounded-md" />}
                      </div>
                    )}
                  </CardContent>
                  {!done && (
                    <CardFooter>
                      <Button size="sm" disabled={!mediaFile || uploading || submittingTask === task.id}
                        onClick={() => handleSubmit(task.id)}>
                        {uploading && submittingTask === task.id ? 'Invio...' : 'Consegna foto'}
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'leaderboard' && (
        <Card>
          <CardHeader><CardTitle>Classifica</CardTitle></CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-center text-text-muted py-8">Nessun partecipante ancora</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={entry.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-muted'}`}>
                    <div className={`text-xl font-bold min-w-8 text-center ${i === 0 ? 'text-amber-500' : i < 3 ? 'text-brand' : 'text-text-muted'}`}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{entry.guest_name}</p>
                      <Badge variant="outline" className="capitalize text-xs">{entry.role}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-brand">{entry.score}</p>
                      <p className="text-xs text-text-muted">{entry.tasks_done} foto</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-error text-center">{error}</p>}
    </main>
  );
}
