'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  computeCapsulePriceCents,
  formatCapsulePrice,
  CAPSULE_MAX_VIDEO_SECONDS,
  CAPSULE_MAX_PHRASE_CHARS,
  CAPSULE_MIN_MONTHS,
  CAPSULE_MAX_MONTHS,
} from '@fotosposi/time-capsule';

interface CapsuleItem {
  id: string;
  sender_name: string;
  sender_type: string;
  recipient_type: string;
  recipient_name: string | null;
  recipient_email: string | null;
  recipient_whatsapp: string | null;
  status: string | null;
  reveal_at: string;
  delivered_at: string | null;
  r2_key: string | null;
  payment_required: boolean | null;
  price_cents: number | null;
  delivery_channel: string | null;
  last_error: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'In attesa di pagamento',
  processing: 'Elaborazione watermark',
  scheduled: 'Programmata',
  delivered: 'Consegnata',
  failed: 'Fallita',
};

const STATUS_STYLES: Record<string, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-gray-100 text-gray-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

function addMonths(d: Date, m: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + m);
  return r;
}

function toInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function CapsuleClient({
  eventId,
  isCouple,
  guests,
  backHref,
}: {
  eventId: string;
  isCouple: boolean;
  guests: Array<{ id: string; name: string }>;
  backHref?: string;
}) {
  const [items, setItems] = useState<CapsuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [phrase, setPhrase] = useState('');
  const [deliverAt, setDeliverAt] = useState('');
  const [recipientMode, setRecipientMode] = useState<'guest' | 'email' | 'whatsapp'>('guest');
  const [recipientGuestId, setRecipientGuestId] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientWhatsapp, setRecipientWhatsapp] = useState('');
  const [senderName, setSenderName] = useState('');

  const minDate = useMemo(() => toInputValue(addMonths(new Date(), CAPSULE_MIN_MONTHS)), []);
  const maxDate = useMemo(() => toInputValue(addMonths(new Date(), CAPSULE_MAX_MONTHS)), []);

  const price = useMemo(() => {
    if (!deliverAt) return null;
    const d = new Date(deliverAt);
    const months = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.4375);
    const r = computeCapsulePriceCents(months);
    return r.error ? null : r.cents;
  }, [deliverAt]);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/capsule`, { method: 'GET' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Errore caricamento');
      setItems(json.capsules ?? []);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid')) setNotice('Pagamento completato: la capsula verrà elaborata a breve.');
    if (params.get('cancelled')) setError('Pagamento annullato: la capsula non è stata creata.');
  }, []);

  function onVideoPick(file: File | null) {
    if (!file) { setVideoFile(null); return; }
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (v.duration > CAPSULE_MAX_VIDEO_SECONDS) {
        setError(`Video troppo lungo: max ${CAPSULE_MAX_VIDEO_SECONDS / 60} minuti (sono ${Math.round(v.duration / 60)} min)`);
        setVideoFile(null);
      } else {
        setError(null);
        setVideoFile(file);
      }
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      setError('File video non leggibile');
      setVideoFile(null);
    };
    v.src = url;
  }

  async function handleSubmit() {
    setError(null);
    if (!videoFile) { setError('Seleziona un video (max 3 minuti)'); return; }
    if (!deliverAt) { setError('Scegli quando dovrà essere trasmessa'); return; }

    setSubmitting(true);
    try {
      const presignRes = await fetch(`/api/events/${eventId}/capsule/presign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: videoFile.name, contentType: videoFile.type || 'video/mp4', fileSize: videoFile.size }),
      });
      const presignJson = await presignRes.json();
      if (!presignRes.ok) throw new Error(presignJson.error || 'Errore presign');

      const putRes = await fetch(presignJson.presignedUrl, {
        method: 'PUT',
        body: videoFile,
        headers: { 'Content-Type': videoFile.type || 'video/mp4' },
      });
      if (!putRes.ok) throw new Error('Upload video fallito');

      const createRes = await fetch(`/api/events/${eventId}/capsule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoR2Key: presignJson.key,
          watermarkPhrase: phrase,
          deliverAt: new Date(deliverAt).toISOString(),
          recipientMode: undefined,
          recipientGuestId: !isCouple || recipientMode !== 'guest' ? undefined : recipientGuestId || undefined,
          recipientEmail: isCouple && recipientMode === 'email' ? recipientEmail : undefined,
          recipientWhatsapp: isCouple && recipientMode === 'whatsapp' ? recipientWhatsapp : undefined,
          senderName: senderName || undefined,
          successUrl: `${window.location.origin}/events/${eventId}/capsule?paid=1`,
          cancelUrl: `${window.location.origin}/events/${eventId}/capsule?cancelled=1`,
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok) throw new Error(createJson.error || 'Errore creazione capsula');

      if (createJson.checkoutUrl) {
        window.location.href = createJson.checkoutUrl;
        return;
      }

      setNotice('Capsula creata: verrà elaborata e trasmessa alla data scelta.');
      setVideoFile(null);
      setPhrase('');
      setDeliverAt('');
      await loadList();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWatch(item: CapsuleItem) {
    try {
      const res = await fetch(`/api/events/${eventId}/capsule/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ r2Key: item.r2_key }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Video non disponibile');
      window.open(json.url, '_blank');
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Capsula del Tempo</h1>
          {backHref && (
            <a href={backHref} className="text-sm text-rose-600 hover:underline">← Torna all'evento</a>
          )}
        </div>

        {notice && (
          <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>
        )}
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        <div className="rounded-lg border bg-white p-4 md:p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {isCouple
              ? 'Registra un video messaggio (max 3 minuti) da trasmettere a un invitato, via email o WhatsApp, tra 6 mesi e 5 anni da oggi. Gratis fino a 12 mesi; oltre, extra proporzionale al tempo.'
              : 'Registra un video messaggio (max 3 minuti) per gli sposi, da trasmettere tra 6 mesi e 5 anni. La capsula è a pagamento con una somma proporzionale al tempo.'}
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">Video (max 3 minuti)</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => onVideoPick(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
            {videoFile && <p className="text-xs text-muted-foreground mt-1">{videoFile.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Frase nel watermark (opzionale, max {CAPSULE_MAX_PHRASE_CHARS} caratteri)
            </label>
            <input
              type="text"
              value={phrase}
              maxLength={CAPSULE_MAX_PHRASE_CHARS}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder="Es. Ci vediamo tra un anno!"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nel watermark comparirà la tua frase, il logo e la dicitura della capsula.
            </p>
          </div>

          {isCouple && (
            <div className="space-y-2">
              <label className="block text-sm font-medium">Destinatario</label>
              <div className="flex flex-wrap gap-2 text-sm">
                <button type="button" onClick={() => setRecipientMode('guest')}
                  className={`rounded-full px-3 py-1 border ${recipientMode === 'guest' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white'}`}>
                  Invitato loggato
                </button>
                <button type="button" onClick={() => setRecipientMode('email')}
                  className={`rounded-full px-3 py-1 border ${recipientMode === 'email' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white'}`}>
                  Email
                </button>
                <button type="button" onClick={() => setRecipientMode('whatsapp')}
                  className={`rounded-full px-3 py-1 border ${recipientMode === 'whatsapp' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white'}`}>
                  WhatsApp
                </button>
              </div>
              {recipientMode === 'guest' && (
                <select value={recipientGuestId} onChange={(e) => setRecipientGuestId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="">Seleziona un invitato…</option>
                  {guests.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
              {recipientMode === 'email' && (
                <input type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="email@destinatario.it"
                  className="w-full rounded-md border px-3 py-2 text-sm" />
              )}
              {recipientMode === 'whatsapp' && (
                <input type="tel" value={recipientWhatsapp} onChange={(e) => setRecipientWhatsapp(e.target.value)}
                  placeholder="+39 333 1234567"
                  className="w-full rounded-md border px-3 py-2 text-sm" />
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Quando dovrà essere trasmessa</label>
            <input
              type="date"
              value={deliverAt}
              min={minDate}
              max={maxDate}
              onChange={(e) => setDeliverAt(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tra 6 mesi e 5 anni da oggi ({minDate} → {maxDate}).
            </p>
          </div>

          {price !== null && (
            <div className="rounded-md bg-gray-50 px-4 py-3 text-sm">
              Prezzo: <span className="font-semibold">{formatCapsulePrice(price)}</span>
              {isCouple && price === 0 && ' (gratis fino a 12 mesi)'}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-md bg-rose-600 px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Caricamento…' : price !== null && price > 0 ? 'Paga e crea la capsula' : 'Crea la capsula'}
          </button>
        </div>

        <div className="rounded-lg border bg-white p-4 md:p-6 space-y-3">
          <h2 className="text-lg font-medium">{isCouple ? 'Capsule dell\u2019evento' : 'Le tue capsule'}</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna capsula ancora.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.sender_name} → {item.recipient_type === 'sposi' ? 'Sposi' : (item.recipient_name || item.recipient_email || item.recipient_whatsapp || '—')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Trasmissione: {new Date(item.reveal_at).toLocaleDateString('it-IT')}
                      {item.price_cents ? ` · ${formatCapsulePrice(item.price_cents)}` : ''}
                      {item.last_error ? ` · ${item.last_error}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status ?? 'scheduled'] ?? 'bg-gray-100'}`}>
                      {STATUS_LABELS[item.status ?? 'scheduled'] ?? item.status}
                    </span>
                    {item.status === 'delivered' && item.r2_key && (
                      <button type="button" onClick={() => handleWatch(item)}
                        className="text-xs text-rose-600 hover:underline">
                        Guarda
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
