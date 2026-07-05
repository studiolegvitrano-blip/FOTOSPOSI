'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DiaryEntry {
  id: string;
  event_id: string;
  phase: string;
  task: string;
  status: string;
  notes: string | null;
  financial_link: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const PHASES = ['bozza', 'confermato', 'esecuzione', 'completato'];

export default function WorkDiaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [summary, setSummary] = useState({ total: 0, todo: 0, done: 0, cancelled: 0, phase: 'bozza' });
  const [task, setTask] = useState('');
  const [notes, setNotes] = useState('');
  const [financialLink, setFinancialLink] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then(({ user }) => { if (!user) router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); });
    load();
  }, [id]);

  const load = async () => {
    const [eRes, sRes] = await Promise.all([
      fetch(`/api/events/${id}/diary`),
      fetch(`/api/events/${id}/diary?type=summary`),
    ]);
    if (eRes.ok) { const d = await eRes.json(); setEntries(d.entries || []); }
    if (sRes.ok) { const d = await sRes.json(); setSummary(d.summary || summary); }
  };

  const handleSubmit = async () => {
    if (!task.trim()) return;
    const res = await fetch(`/api/events/${id}/diary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, notes, financial_link: financialLink || undefined, due_date: dueDate || undefined }),
    });
    if (res.ok) { setTask(''); setNotes(''); setFinancialLink(''); setDueDate(''); load(); }
  };

  const toggleStatus = async (entry: DiaryEntry) => {
    const newStatus = entry.status === 'done' ? 'todo' : 'done';
    const res = await fetch(`/api/events/${id}/diary/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) load();
  };

  const deleteEntry = async (entryId: string) => {
    const res = await fetch(`/api/events/${id}/diary/${entryId}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Diario di Lavorazione</h1>
        <div className="flex gap-2">
          <Badge variant="outline">Fase: {summary.phase}</Badge>
          <Button variant="ghost" onClick={() => router.push(`/events/${id}`)}>←</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Riepilogo</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-4 text-sm">
            <span>Totale: <strong>{summary.total}</strong></span>
            <span className="text-yellow-600">Da fare: <strong>{summary.todo}</strong></span>
            <span className="text-green-600">Fatto: <strong>{summary.done}</strong></span>
            <span className="text-red-600">Cancellati: <strong>{summary.cancelled}</strong></span>
          </div>
          <div className="flex gap-2 mt-2">
            {PHASES.map(p => (
              <Button key={p} size="sm" variant={summary.phase === p ? 'default' : 'outline'} onClick={async () => {
                await fetch(`/api/events/${id}/diary`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ task: `Fase: ${p}`, phase: p, notes: 'Cambio fase' }),
                });
                load();
              }}>{p}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Nuovo compito</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={task} onChange={e => setTask(e.target.value)} placeholder="Compito" />
          <textarea className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note (opzionale)" rows={2} />
          <div className="flex gap-3">
            <input className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm" value={financialLink} onChange={e => setFinancialLink(e.target.value)} placeholder="Link redditività (es. Stripe ID)" />
            <input type="date" className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <Button onClick={handleSubmit}>Aggiungi</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {entries.map(entry => (
          <Card key={entry.id} className={entry.status === 'done' ? 'opacity-60' : ''}>
            <CardContent className="flex items-start justify-between gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${entry.status === 'done' ? 'line-through' : ''}`}>{entry.task}</p>
                {entry.notes && <p className="text-sm text-text-muted">{entry.notes}</p>}
                {entry.financial_link && <p className="text-xs text-brand">💰 {entry.financial_link}</p>}
                {entry.due_date && <p className="text-xs text-text-muted">Scadenza: {new Date(entry.due_date).toLocaleDateString('it-IT')}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Badge variant={entry.status === 'done' ? 'default' : 'secondary'}>{entry.status === 'done' ? 'Fatto' : entry.status === 'cancelled' ? 'Annullato' : 'Da fare'}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleStatus(entry)}>
                  {entry.status === 'done' ? 'Ri apri' : 'Completa'}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteEntry(entry.id)}>✕</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 && <p className="text-text-muted text-center py-4">Nessun compito. Aggiungine uno sopra.</p>}
      </div>
    </main>
  );
}
