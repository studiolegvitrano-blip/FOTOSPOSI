'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { getPreferences, updatePreference, getNotificationLog } from '@fotosposi/notifications';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CHANNELS = [
  { id: 'email', label: 'Email', desc: 'Notifiche via email' },
  { id: 'whatsapp', label: 'WhatsApp', desc: 'Notifiche via WhatsApp' },
  { id: 'push', label: 'Push', desc: 'Notifiche in-app' },
];

export default function NotificationsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      loadData();
    });
  }, [id]);

  const loadData = async () => {
    const [p, l] = await Promise.all([getPreferences(id), getNotificationLog(id)]);
    if (p.prefs) setPrefs(Object.fromEntries(p.prefs.map(x => [x.channel, x.enabled])));
    if (l.logs) setLogs(l.logs);
  };

  const toggle = async (channel: string) => {
    const newVal = !prefs[channel];
    await updatePreference(id, channel, newVal);
    setPrefs({ ...prefs, [channel]: newVal });
  };

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifiche</h1>
        <Button variant="ghost" onClick={() => router.push(`/events/${id}`)}>← Evento</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Canali di notifica</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {CHANNELS.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="font-medium">{c.label}</p>
                <p className="text-sm text-text-muted">{c.desc}</p>
              </div>
              <button
                onClick={() => toggle(c.id)}
                className={`w-12 h-6 rounded-full transition-colors relative ${prefs[c.id] !== false ? 'bg-brand' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs[c.id] !== false ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Log notifiche</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-text-muted text-sm">Nessuna notifica inviata</p>
          ) : (
            <div className="space-y-2">
              {logs.map(l => (
                <div key={l.id} className="flex items-center justify-between p-2 rounded-md border border-border text-sm">
                  <div>
                    <p className="font-medium">{l.subject || l.channel}</p>
                    <p className="text-text-muted text-xs">{l.recipient} — {new Date(l.created_at).toLocaleString('it-IT')}</p>
                  </div>
                  <Badge variant={l.status === 'sent' ? 'success' : l.status === 'failed' ? 'destructive' : 'warning'}>{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
