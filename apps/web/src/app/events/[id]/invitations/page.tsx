'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getCurrentUser } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Users, Plus, Trash2, Mail, MessageSquare, Download, FileText,
  FileSpreadsheet, Loader2, CalendarClock, Send, ChevronDown, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import type { InvitedGuest, InsistLevel, GuestStatus } from '@fotosposi/invitations';

interface GuestForm {
  name: string;
  email: string;
  whatsapp: string;
  insist_level: InsistLevel;
  status: GuestStatus;
}

const EMPTY_FORM: GuestForm = { name: '', email: '', whatsapp: '', insist_level: 'medium', status: 'pending' };

const STATUS_BADGE: Record<GuestStatus, { label: string; cls: string }> = {
  pending: { label: 'In attesa', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmed: { label: 'Confermato', cls: 'bg-green-100 text-green-700 border-green-200' },
  declined: { label: 'Rifiutato', cls: 'bg-red-100 text-red-600 border-red-200' },
};

const INSIST_BADGE: Record<InsistLevel, { label: string; cls: string }> = {
  low: { label: 'Bassa', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  medium: { label: 'Media', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  high: { label: 'Alta', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
};

export default function InvitationsPage() {
  const t = useTranslations('invitations');
  const c = useTranslations('common');
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<InvitedGuest[]>([]);
  const [autoReminder, setAutoReminder] = useState(false);
  const [daysBefore, setDaysBefore] = useState(7);
  const [brand, setBrand] = useState<string | null>(null);
  const [coupleName, setCoupleName] = useState('');

  const [form, setForm] = useState<GuestForm>(EMPTY_FORM);
  const [batchText, setBatchText] = useState('');
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindingAll, setRemindingAll] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/invitations`, { credentials: 'same-origin' });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        if (res.status === 403 || res.status === 404) router.replace(`/events/${eventId}`);
        throw new Error(d?.error ?? `HTTP ${res.status}`);
      }
      const d = await res.json();
      setGuests(d.guests);
      setAutoReminder(d.settings.autoReminder);
      setDaysBefore(d.settings.daysBefore);
      setBrand(d.brand);
      setCoupleName(d.coupleName);
    } catch (e) {
      setNotice({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (!u) router.replace(`/login?redirect=/events/${eventId}/invitations`);
    });
    load();
  }, [load, eventId, router]);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleAddSingle = async () => {
    if (!form.name.trim()) return flash('err', t('name_required'));
    if (!form.email.trim() && !form.whatsapp.trim()) return flash('err', t('contact_required'));
    setAdding(true);
    try {
      const res = await fetch(`/api/events/${eventId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'same-origin',
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      setGuests((prev) => [...prev, d.guest]);
      setForm(EMPTY_FORM);
      flash('ok', t('added'));
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleBatch = async () => {
    const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const guests = lines.map((line) => {
      // Formato: "Nome;email;whatsapp" oppure "Nome;email" oppure "Nome".
      const parts = line.split(';').map((p) => p.trim());
      return { name: parts[0] || '', email: parts[1] || undefined, whatsapp: parts[2] || undefined };
    });
    setAdding(true);
    try {
      const res = await fetch(`/api/events/${eventId}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests }),
        credentials: 'same-origin',
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      await load();
      setBatchText('');
      flash('ok', `${t('added_batch')} (${d.created})`);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<InvitedGuest>) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/events/${eventId}/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
        credentials: 'same-origin',
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      setGuests((prev) => prev.map((g) => (g.id === id ? d.guest : g)));
      flash('ok', t('saved'));
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm_delete'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${eventId}/invitations/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setGuests((prev) => prev.filter((g) => g.id !== id));
      flash('ok', t('deleted'));
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRemindOne = async (id: string) => {
    setRemindingId(id);
    try {
      const res = await fetch(`/api/events/${eventId}/invitations/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: [id] }),
        credentials: 'same-origin',
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      if (d.sent > 0) {
        await load();
        flash('ok', t('reminded'));
      } else {
        flash('err', d.failed > 0 ? (d.results?.[0]?.error ?? t('remind_failed')) : t('remind_failed'));
      }
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setRemindingId(null);
    }
  };

  const handleRemindAll = async () => {
    if (!confirm(t('confirm_remind_all'))) return;
    setRemindingAll(true);
    try {
      const res = await fetch(`/api/events/${eventId}/invitations/remind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allPending: true }),
        credentials: 'same-origin',
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      await load();
      flash(d.sent > 0 ? 'ok' : 'err', d.sent > 0 ? t('reminded_all', { n: d.sent }) : (d.error ?? t('remind_failed')));
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    } finally {
      setRemindingAll(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/invitations/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoReminder, daysBefore }),
        credentials: 'same-origin',
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? `HTTP ${res.status}`);
      flash('ok', t('settings_saved'));
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    }
  };

  const downloadExport = async (format: 'pdf' | 'word' | 'csv') => {
    try {
      const res = await fetch(`/api/events/${eventId}/invitations/export?format=${format}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'word' ? 'doc' : format;
      a.download = `Lista-Invitati.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : String(e));
    }
  };

  const pendingCount = guests.filter((g) => g.status === 'pending').length;
  const confirmedCount = guests.filter((g) => g.status === 'confirmed').length;
  const declinedCount = guests.filter((g) => g.status === 'declined').length;

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-7 w-7 text-sky-600" />
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('subtitle')} {coupleName ? `— ${coupleName}` : ''}
          </p>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 rounded-md border px-4 py-2 text-sm ${
            notice.kind === 'ok'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* KPI */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{guests.length}</div>
            <div className="text-xs text-muted-foreground">{t('kpi_total')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">{t('kpi_pending')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <span className="text-green-600 font-bold text-xl">{confirmedCount}</span>
              <span className="text-red-500 font-bold text-xl">{declinedCount}</span>
            </div>
            <div className="text-xs text-muted-foreground">{t('kpi_yes_no')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Aggiungi */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> {t('add_single')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Label>{t('name')}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mario Rossi" />
          </div>
          <div className="lg:col-span-1">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="mario@example.com" />
          </div>
          <div className="lg:col-span-1">
            <Label>{t('whatsapp')}</Label>
            <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+393331112222" />
          </div>
          <div className="lg:col-span-1">
            <Label>{t('insist_level')}</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.insist_level}
              onChange={(e) => setForm({ ...form, insist_level: e.target.value as InsistLevel })}
            >
              <option value="low">{t('insist_low')}</option>
              <option value="medium">{t('insist_medium')}</option>
              <option value="high">{t('insist_high')}</option>
            </select>
          </div>
          <div className="lg:col-span-1 flex items-end">
            <Button className="w-full" onClick={handleAddSingle} disabled={adding}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              {t('add')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Batch */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ChevronDown className="h-4 w-4" /> {t('add_batch')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-xs text-muted-foreground">{t('batch_hint')}</p>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            rows={5}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder="Mario Rossi;mario@example.com;+393331112222&#10;Giulia Bianchi;giulia@example.com&#10;Luca Verdi"
          />
          <Button className="mt-2" variant="outline" onClick={handleBatch} disabled={adding}>
            {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Users className="h-4 w-4 mr-1" />}
            {t('add_batch_btn')}
          </Button>
        </CardContent>
      </Card>

      {/* Azioni lista */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRemindAll} disabled={remindingAll || pendingCount === 0}>
          {remindingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
          {t('remind_all')}
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button variant="outline" size="sm" onClick={() => downloadExport('pdf')}>
          <FileText className="h-4 w-4 mr-1" /> {t('export_pdf')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadExport('word')}>
          <FileText className="h-4 w-4 mr-1" /> {t('export_word')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => downloadExport('csv')}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> {t('export_csv')}
        </Button>
      </div>

      {/* Impostazioni auto-reminder */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> {t('auto_reminder_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoReminder}
              onChange={(e) => setAutoReminder(e.target.checked)}
              className="h-4 w-4"
            />
            {t('auto_reminder_on')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span>{t('days_before')}</span>
            <Input
              type="number"
              min={0}
              max={30}
              value={daysBefore}
              onChange={(e) => setDaysBefore(Number(e.target.value))}
              className="w-20"
            />
          </label>
          <Button variant="default" size="sm" onClick={handleSaveSettings}>
            {t('settings_save')}
          </Button>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('list_title')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {guests.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">{t('empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2">{t('name')}</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">{t('whatsapp')}</th>
                    <th className="px-4 py-2">{t('insist_level')}</th>
                    <th className="px-4 py-2">{t('status')}</th>
                    <th className="px-4 py-2">{t('reminders')}</th>
                    <th className="px-4 py-2 text-right">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2">
                        <input
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 focus:border-sky-300 focus:bg-background focus:outline-none"
                          defaultValue={g.name}
                          onBlur={(e) => e.target.value !== g.name && handleUpdate(g.id, { name: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs focus:border-sky-300 focus:bg-background focus:outline-none"
                          defaultValue={g.email ?? ''}
                          onBlur={(e) => e.target.value !== (g.email ?? '') && handleUpdate(g.id, { email: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs focus:border-sky-300 focus:bg-background focus:outline-none"
                          defaultValue={g.whatsapp ?? ''}
                          onBlur={(e) => e.target.value !== (g.whatsapp ?? '') && handleUpdate(g.id, { whatsapp: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          className="rounded border border-input bg-background px-1 py-0.5 text-xs"
                          value={g.insist_level}
                          onChange={(e) => handleUpdate(g.id, { insist_level: e.target.value as InsistLevel })}
                        >
                          <option value="low">{t('insist_low')}</option>
                          <option value="medium">{t('insist_medium')}</option>
                          <option value="high">{t('insist_high')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          className={`rounded border px-1 py-0.5 text-xs ${STATUS_BADGE[g.status].cls}`}
                          value={g.status}
                          onChange={(e) => handleUpdate(g.id, { status: e.target.value as GuestStatus })}
                        >
                          <option value="pending">{t('status_pending')}</option>
                          <option value="confirmed">{t('status_confirmed')}</option>
                          <option value="declined">{t('status_declined')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="gap-1">
                          {g.reminder_count > 0 ? (
                            <>
                              {g.reminder_count}/{(g.insist_level === 'high' ? 3 : g.insist_level === 'medium' ? 2 : 1)}
                              {g.last_reminder_at && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(g.last_reminder_at).toLocaleDateString()}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {savingId === g.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title={t('remind_one')}
                            onClick={() => handleRemindOne(g.id)}
                            disabled={remindingId === g.id || g.status !== 'pending'}
                          >
                            {remindingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500"
                            title={t('delete')}
                            onClick={() => handleDelete(g.id)}
                            disabled={deletingId === g.id}
                          >
                            {deletingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
