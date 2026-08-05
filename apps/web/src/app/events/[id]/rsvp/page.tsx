'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Baby, AlertTriangle, Utensils, Loader2, CalendarCheck, FileDown, Mail, Send, X } from 'lucide-react';

interface RsvpResponse {
  id: string;
  host_name: string;
  host_intolerances: string[];
  guests: Array<{ name: string; type: 'adult' | 'minor'; age: number | null; intolerances: string[] }>;
  message: string | null;
  created_at: string;
}

interface Stats {
  totalResponses: number;
  totalPeople: number;
  totalAdults: number;
  totalMinors: number;
  topIntolerances: Array<{ name: string; count: number }>;
}

export default function RsvpAdminPage() {
  const params = useParams();
  const eventId = params.id as string;
  const router = useRouter();
  const [responses, setResponses] = useState<RsvpResponse[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [coupleEmail, setCoupleEmail] = useState('');
  const [brand, setBrand] = useState('');
  const [loading, setLoading] = useState(true);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [sending, setSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    getCurrentUser().then(({ user, error }) => {
      if (error || !user) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
      loadData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (res.status === 403 || res.status === 401) {
          router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        alert(d.error || 'Errore nel caricamento');
        return;
      }
      const data = await res.json();
      setResponses(data.responses ?? []);
      setStats(data.stats ?? null);
      setCoupleEmail(data.coupleEmail ?? '');
      setBrand(data.brand ?? 'Sposi.live');
      setEmailTo(data.coupleEmail ?? '');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = () => {
    const a = document.createElement('a');
    a.href = `/api/events/${eventId}/rsvp/export?format=pdf`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  const sendEmail = async () => {
    setSending(true);
    setEmailResult(null);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmailResult({ ok: true, msg: `Email inviata a ${d.to}` });
      } else {
        setEmailResult({ ok: false, msg: d.error || 'Invio fallito' });
      }
    } catch {
      setEmailResult({ ok: false, msg: 'Errore di rete' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-text-muted" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-2 mb-2">
        <Button size="sm" variant="outline" asChild>
          <a href={`/events/${eventId}`}>← Torna all'evento</a>
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarCheck className="w-6 h-6 text-brand" /> Conferme di presenza
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <FileDown className="w-4 h-4 mr-2" /> Scarica PDF
          </Button>
          <Button variant="default" size="sm" onClick={() => { setEmailOpen(true); setEmailResult(null); setEmailTo(coupleEmail); }}>
            <Mail className="w-4 h-4 mr-2" /> Invia via email
          </Button>
        </div>
      </div>
      <p className="text-text-muted text-sm mb-6">Modulo RSVP del sito-evento: capofamiglia, accompagnatori, età e intolleranze.</p>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{stats.totalResponses}</div>
            <div className="text-xs text-text-muted mt-1">Conferme ricevute</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{stats.totalPeople}</div>
            <div className="text-xs text-text-muted mt-1 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Persone totali</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-brand">{stats.totalAdults}</div>
            <div className="text-xs text-text-muted mt-1 flex items-center justify-center gap-1">Adulti</div>
          </CardContent></Card>
          <Card><CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-amber-600">{stats.totalMinors}</div>
            <div className="text-xs text-text-muted mt-1 flex items-center justify-center gap-1"><Baby className="w-3 h-3" /> Minori</div>
          </CardContent></Card>
        </div>
      )}

      {stats && stats.topIntolerances.length > 0 && (
        <Card className="mb-8">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Utensils className="w-4 h-4" /> Intolleranze più segnalate</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topIntolerances.map((it) => (
                <Badge key={it.name} variant="outline" className="text-sm py-1 px-3">
                  {it.name} <span className="ml-1 text-text-muted">×{it.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {responses.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-text-muted">
          <p>Nessuna conferma ricevuta ancora.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {responses.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <h3 className="font-semibold text-lg">{r.host_name}</h3>
                  <span className="text-xs text-text-muted">{new Date(r.created_at).toLocaleString('it-IT')}</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="secondary">Capofamiglia</Badge>
                  {Array.isArray(r.host_intolerances) && r.host_intolerances.map((it) => (
                    <Badge key={it} variant="outline" className="text-amber-700 border-amber-300">{it}</Badge>
                  ))}
                  {(!Array.isArray(r.host_intolerances) || r.host_intolerances.length === 0) && (
                    <Badge variant="outline" className="text-text-muted">Nessuna intolleranza</Badge>
                  )}
                </div>

                {Array.isArray(r.guests) && r.guests.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-sm font-semibold mb-2">Accompagnatori ({r.guests.length})</p>
                    <div className="space-y-2">
                      {r.guests.map((g, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          {g.type === 'minor' ? (
                            <Baby className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                          ) : (
                            <Users className="w-4 h-4 text-text-muted mt-0.5 shrink-0" />
                          )}
                          <div>
                            <span className="font-medium">{g.name}</span>{' '}
                            <Badge variant={g.type === 'minor' ? 'secondary' : 'outline'} className="ml-1 text-xs">
                              {g.type === 'minor' ? `Minore · ${g.age} anni` : 'Adulto'}
                            </Badge>
                            {Array.isArray(g.intolerances) && g.intolerances.length > 0 && (
                              <span className="ml-2 text-amber-700 text-xs">
                                <AlertTriangle className="w-3 h-3 inline mr-1" />
                                {g.intolerances.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {r.message && (
                  <div className="mt-3 border-t border-border pt-3 text-sm italic text-text-muted">
                    “{r.message}”
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Invia riepilogo via email</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setEmailOpen(false)} aria-label="Chiudi"><X className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-muted mb-3">
                La lettera "Cari Sposi" con numeri e intolleranze verrà inviata come allegato (HTML stampabile → PDF).
                Mittente: <span className="font-medium">{brand === 'JustMarry.live' ? 'info@justmarry.live' : 'info@sposi.live'}</span>
              </p>
              <label className="block text-sm font-medium mb-1" htmlFor="email-to">Destinatario</label>
              <input
                id="email-to"
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="nome@email.it"
                className="w-full border border-border rounded-md px-3 py-2 text-sm mb-3"
              />
              {emailResult && (
                <p className={`text-sm mb-3 ${emailResult.ok ? 'text-green-600' : 'text-red-600'}`}>{emailResult.msg}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEmailOpen(false)}>Annulla</Button>
                <Button size="sm" onClick={sendEmail} disabled={sending || !emailTo.trim()}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Invia
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
