'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { updateEventWatermark, type WeddingEvent } from '@fotosposi/events';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Settings, Image as ImageIcon, Users, Bell, Shield, HardDrive, Globe, Loader2 } from 'lucide-react';

/**
 * Pagina Impostazioni riservata agli sposi (creatore evento): raccoglie in un
 * unico posto tutte le impostazioni prima sparse (watermark su foto/video con
 * testo E font, più i collegamenti alle altre aree di configurazione).
 * Gli invitati che provano ad aprirla vengono rimandati alla pagina evento.
 */
export default function EventSettingsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const [wmNames, setWmNames] = useState(true);
  const [wmText, setWmText] = useState('');
  const [wmFont, setWmFont] = useState('classico');
  const [wmSaving, setWmSaving] = useState(false);
  const [wmSaved, setWmSaved] = useState(false);

  const FONTS: { value: string; label: string; sample: string; css: string }[] = [
    { value: 'classico', label: 'Classico', sample: 'Giulia & Marco', css: '"Playfair Display", Georgia, serif' },
    { value: 'elegante', label: 'Elegante (corsivo)', sample: 'Giulia & Marco', css: '"Dancing Script", cursive' },
    { value: 'moderno', label: 'Moderno', sample: 'Giulia & Marco', css: '"Noto Sans", Arial, sans-serif' },
  ];

  useEffect(() => {
    if (!eventId) return;
    fetch(`/api/events/${eventId}/details`)
      .then((r) => (r.ok ? r.json() : { event: null }))
      .then((d) => {
        if (!d.event || !d.isCreator) { router.push(`/events/${eventId}`); return; }
        setEvent(d.event);
        setWmNames(d.event.watermark_names !== false);
        setWmText(d.event.watermark_text || '');
        setWmFont((d.event as { watermark_font?: string }).watermark_font || 'classico');
        setLoading(false);
      })
      .catch(() => router.push(`/events/${eventId}`));
  }, [eventId, router]);

  const saveWatermark = async () => {
    setWmSaving(true);
    setWmSaved(false);
    const { error } = await updateEventWatermark(eventId, {
      watermark_names: wmNames,
      watermark_text: wmText,
      watermark_font: wmFont,
    });
    setWmSaving(false);
    if (!error) { setWmSaved(true); setTimeout(() => setWmSaved(false), 3000); }
    else alert(`Salvataggio non riuscito: ${error}`);
  };

  if (loading || !event) return (
    <main className="max-w-2xl mx-auto p-4 flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-6 h-6 animate-spin text-brand" />
    </main>
  );

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      {/* I font vanno caricati anche nel browser per l'anteprima della scelta */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Dancing+Script:wght@700&display=swap');
      `}</style>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6" /> Impostazioni</h1>
        <Button variant="ghost" onClick={() => router.push(`/events/${eventId}`)}>← Torna all'evento</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Watermark su foto e video</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={wmNames} onChange={(e) => setWmNames(e.target.checked)} />
            Vuoi che nelle foto e nei video ci siano impressi i Vostri nomi?
          </label>

          {wmNames && (
            <div className="space-y-2">
              <p className="text-xs text-text-muted">Scegli un suggerimento o scrivi il testo che preferisci:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  [event.couple_name, 'Sposi', event.location, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' '),
                  [event.couple_name, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' — '),
                  ['W gli Sposi!', event.couple_name, new Date(event.date).toLocaleDateString('it-IT')].filter(Boolean).join(' '),
                ].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setWmText(s)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${wmText === s ? 'border-brand bg-brand/10 font-medium' : 'border-border bg-background hover:border-brand/50'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                maxLength={80}
                placeholder={`es. ${event.couple_name} Sposi ${event.location} ${new Date(event.date).toLocaleDateString('it-IT')}`}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background"
              />

              <p className="text-xs text-text-muted mt-3">Scegli il carattere con cui verrà impresso il testo:</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {FONTS.map(f => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setWmFont(f.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${wmFont === f.value ? 'border-brand bg-brand/10' : 'border-border bg-background hover:border-brand/50'}`}
                  >
                    <p className="text-xs text-text-muted">{f.label}</p>
                    <p className="text-xl leading-snug" style={{ fontFamily: f.css }}>{wmText || event.couple_name || f.sample}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-text-muted">Il logo Sposi.live è sempre presente in basso a destra.</p>

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveWatermark} disabled={wmSaving}>
              {wmSaving ? 'Salvataggio...' : 'Salva'}
            </Button>
            {wmSaved && <span className="text-sm text-success">Salvato ✓</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Altre impostazioni</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/guests`}><Users className="w-4 h-4 mr-2" /> Invitati e accessi</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/privacy`}><Shield className="w-4 h-4 mr-2" /> Privacy</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/notifications`}><Bell className="w-4 h-4 mr-2" /> Notifiche</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/drive`}><HardDrive className="w-4 h-4 mr-2" /> Backup Google Drive</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/site-builder`}><Globe className="w-4 h-4 mr-2" /> Sito degli sposi</Link>
          </Button>
          <Button variant="outline" className="justify-start" asChild>
            <Link href={`/events/${eventId}/tier`}>⭐ Piano evento (Free/Premium)</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
