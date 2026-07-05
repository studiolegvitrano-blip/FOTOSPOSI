'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser, getEventGuests, updateGuestStatus, getEventById, updateGuestApprovalMode, type EventGuest } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Settings } from 'lucide-react';

export default function GuestsPage() {
  const params = useParams();
  const eventId = params.id as string;
  const router = useRouter();
  const [guests, setGuests] = useState<EventGuest[]>([]);
  const [approvalMode, setApprovalMode] = useState<'auto' | 'manual'>('auto');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(({ user, error }) => {
      if (error || !user) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
      loadData();
    });
  }, [eventId]);

  const loadData = async () => {
    const [g, e] = await Promise.all([
      getEventGuests(eventId),
      getEventById(eventId),
    ]);
    if (g.guests) setGuests(g.guests);
    if (e.event) setApprovalMode((e.event as any).guest_approval_mode || 'auto');
    setLoading(false);
  };

  const handleStatus = async (guestId: string, status: 'pending' | 'approved' | 'denied') => {
    await updateGuestStatus(guestId, status);
    setGuests(prev => prev.map(g => g.id === guestId ? { ...g, status } : g));
  };

  const toggleMode = async () => {
    const newMode = approvalMode === 'auto' ? 'manual' : 'auto';
    await updateGuestApprovalMode(eventId, newMode);
    setApprovalMode(newMode);
  };

  if (loading) return <main className="max-w-3xl mx-auto p-4"><p className="text-center mt-8">Caricamento...</p></main>;

  const pending = guests.filter(g => g.status === 'pending');
  const approved = guests.filter(g => g.status === 'approved');
  const denied = guests.filter(g => g.status === 'denied');

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ospiti</h1>
        <Button variant="ghost" onClick={() => router.push(`/events/${eventId}`)}>← Torna</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" /> Impostazioni approvazione</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-sm text-text-muted">
            {approvalMode === 'auto'
              ? 'Tutti gli ospiti vengono approvati automaticamente.'
              : 'Devi approvare manualmente ogni ospite.'}
          </p>
          <Button variant={approvalMode === 'manual' ? 'default' : 'outline'} size="sm" onClick={toggleMode}>
            {approvalMode === 'auto' ? 'Approvazione manuale' : 'Approvazione automatica'}
          </Button>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> In attesa ({pending.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pending.map(g => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">{g.name}</p>
                  {g.email && <p className="text-xs text-text-muted">{g.email}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => handleStatus(g.id, 'approved')}>
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Approva
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleStatus(g.id, 'denied')}>
                    <XCircle className="w-4 h-4 mr-1" /> Rifiuta
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {approved.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Approvati ({approved.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {approved.map(g => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">{g.name}</p>
                  {g.email && <p className="text-xs text-text-muted">{g.email}</p>}
                </div>
                <Badge variant="default">Approvato</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {denied.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><XCircle className="w-4 h-4 text-error" /> Rifiutati ({denied.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {denied.map(g => (
              <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium">{g.name}</p>
                  {g.email && <p className="text-xs text-text-muted">{g.email}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={() => handleStatus(g.id, 'approved')}>Riammetti</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {guests.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-text-muted">Nessun ospite registrato.</CardContent>
        </Card>
      )}
    </main>
  );
}
