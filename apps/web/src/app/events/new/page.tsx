'use client';

import { useState, useEffect } from 'react';
import { createEvent, getEventsByUser } from '@fotosposi/events';
import { getCurrentUser, type Tier } from '@fotosposi/core';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function NewEventPage() {
  const [user, setUser] = useState<User | null>(null);
  // 'plan' = scelta del piano (il "carrello": Free a 0€ oppure Premium/Deluxe a pagamento)
  // prima di poter compilare i dettagli evento — senza questo step chiunque poteva creare
  // eventi illimitati sul piano Free senza mai passare da un pagamento/limite.
  const [step, setStep] = useState<'plan' | 'details'>('plan');
  const [selectedTier, setSelectedTier] = useState<Tier>('free');
  const [hasFreeEvent, setHasFreeEvent] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(true);

  const [coupleName, setCoupleName] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [church, setChurch] = useState('');
  const [churchAddress, setChurchAddress] = useState('');
  const [churchCity, setChurchCity] = useState('');
  const [venue, setVenue] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [venueCity, setVenueCity] = useState('');
  const [allowGuestMedia, setAllowGuestMedia] = useState(true);
  // Watermark: "Vuoi che nelle foto e nei video ci siano impressi i Vostri nomi?"
  // Se sì, gli sposi possono scegliere un testo suggerito (nomi + Sposi + città + data)
  // o scriverne uno libero. Il logo Sposi.live resta SEMPRE impresso a prescindere.
  const [watermarkNames, setWatermarkNames] = useState(true);
  const [watermarkText, setWatermarkText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDriveStep, setShowDriveStep] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then(async ({ user: u }) => {
      if (!u) { router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`); return; }
      setUser(u);
      // Il piano Free permette 1 solo evento gratuito per utente — verifichiamo qui se ne ha
      // già uno, per bloccare la creazione di un secondo evento Free (deve passare a un piano
      // a pagamento, o all'acquisto multiplo per professionisti già presente in /tier).
      const { events } = await getEventsByUser(u.id);
      setHasFreeEvent(!!events?.some(e => e.tier === 'free'));
      setCheckingPlan(false);
    });
  }, [router]);

  const choosePlan = (tier: Tier) => {
    if (tier === 'free' && hasFreeEvent) return;
    setSelectedTier(tier);
    if (tier === 'free') setStep('details');
    // Premium/Deluxe: il pagamento reale richiede Stripe (non ancora configurato) — vedi
    // bottone disabilitato sotto, coerente con /events/[id]/tier.
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');

    const { event, error: err } = await createEvent({
      tenant_id: user.id,
      created_by: user.id,
      couple_name: coupleName,
      date,
      location,
      church: church || undefined,
      church_address: churchAddress || undefined,
      church_city: churchCity || undefined,
      venue: venue || undefined,
      venue_address: venueAddress || undefined,
      venue_city: venueCity || undefined,
      brand: 'fotosposi',
      tier: selectedTier,
      allow_guest_media: allowGuestMedia,
      watermark_names: watermarkNames,
      watermark_text: watermarkNames && watermarkText.trim() ? watermarkText.trim() : undefined,
    });

    setLoading(false);
    if (err) {
      setError(err);
    } else if (event) {
      setCreatedEventId(event.id);
      setShowDriveStep(true);
    }
  };

  const handleSkipDrive = () => {
    if (createdEventId) router.push(`/events/${createdEventId}`);
  };

  const handleConnectDrive = () => {
    if (createdEventId) router.push(`/events/${createdEventId}/drive`);
  };

  if (step === 'plan') {
    return (
      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scegli il piano per il tuo evento</h1>
          <p className="text-text-muted text-sm mt-1">Prima di creare l'evento, scegli un piano. Il piano Free è gratuito (0€), Premium e Deluxe richiedono il pagamento.</p>
        </div>

        {checkingPlan ? (
          <p className="text-text-muted">Verifica piano in corso...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle>Free</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">€0</p>
                <ul className="text-sm space-y-1">
                  <li>✓ max 100 foto</li>
                  <li>✗ compresse (SD)</li>
                  <li>✗ niente video</li>
                  <li>✓ wall + giochi base</li>
                  <li>✓ 1 evento per account</li>
                </ul>
                {hasFreeEvent ? (
                  <>
                    <Badge variant="secondary">Limite raggiunto</Badge>
                    <p className="text-xs text-text-muted">Hai già un evento sul piano Free. Per crearne un altro serve un piano a pagamento.</p>
                  </>
                ) : (
                  <Button className="w-full" onClick={() => choosePlan('free')}>Crea gratis</Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-brand/30">
              <CardHeader><CardTitle>Premium</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">€229</p>
                <ul className="text-sm space-y-1">
                  <li>✓ foto e video illimitati</li>
                  <li>✓ Drive backup</li>
                  <li>✓ tutti i giochi</li>
                  <li>✓ Time Capsule</li>
                  <li>✓ sito-evento brandizzato</li>
                </ul>
                <Button className="w-full" disabled title="Richiede configurazione Stripe">
                  Passa a Premium (richiede Stripe)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Deluxe</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold">€375</p>
                <ul className="text-sm space-y-1">
                  <li>✓ tutto Premium</li>
                  <li>✓ app mobile brandizzata</li>
                  <li>✓ AI concierge</li>
                  <li>✓ kiosk selfie</li>
                </ul>
                <Button className="w-full" disabled title="Richiede configurazione Stripe">
                  Passa a Deluxe (richiede Stripe)
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <Button variant="link" asChild><a href="/dashboard">← Torna alla dashboard</a></Button>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 500, margin: '2rem auto', padding: '0 1rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>Crea il tuo evento</h1>
      <p style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: '#666' }}>
        Piano scelto: <strong>{selectedTier === 'free' ? 'Free (0€)' : selectedTier}</strong> — <a href="#" onClick={(e) => { e.preventDefault(); setStep('plan'); }} style={{ color: '#d4a574' }}>cambia</a>
      </p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Nome degli sposi</label>
          <input
            type="text"
            value={coupleName}
            onChange={(e) => setCoupleName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Data del matrimonio</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.25rem' }}>Luogo (città)</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #eee', borderRadius: '6px' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Cerimonia</p>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Nome (es. Chiesa San Pietro)</label>
          <input
            type="text"
            value={church}
            onChange={(e) => setChurch(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', marginBottom: '0.5rem' }}
          />
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Indirizzo (es. Via Roma 10)</label>
          <input
            type="text"
            value={churchAddress}
            onChange={(e) => setChurchAddress(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', marginBottom: '0.5rem' }}
          />
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>
            Comune della cerimonia (lascia vuoto se uguale a "Luogo")
          </label>
          <input
            type="text"
            value={churchCity}
            onChange={(e) => setChurchCity(e.target.value)}
            placeholder={location || 'es. Roma'}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
          <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.35rem' }}>
            Nome, indirizzo e comune vengono usati per generare il link "apri nel navigatore" nella pagina evento.
          </p>
        </div>
        <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #eee', borderRadius: '6px' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Ricevimento</p>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Nome (es. Villa Bianca)</label>
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', marginBottom: '0.5rem' }}
          />
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>Indirizzo (es. Via dei Fiori 5)</label>
          <input
            type="text"
            value={venueAddress}
            onChange={(e) => setVenueAddress(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', marginBottom: '0.5rem' }}
          />
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: '#666' }}>
            Comune del ricevimento (lascia vuoto se uguale a "Luogo")
          </label>
          <input
            type="text"
            value={venueCity}
            onChange={(e) => setVenueCity(e.target.value)}
            placeholder={location || 'es. Roma'}
            style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
            <input
              type="checkbox"
              checked={allowGuestMedia}
              onChange={(e) => setAllowGuestMedia(e.target.checked)}
            />
            Consenti agli invitati di scattare foto e video
          </label>
        </div>
        <div style={{ marginBottom: '1rem', padding: '0.75rem', border: '1px solid #eee', borderRadius: '6px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={watermarkNames}
              onChange={(e) => setWatermarkNames(e.target.checked)}
            />
            Vuoi che nelle foto e nei video ci siano impressi i Vostri nomi?
          </label>
          {watermarkNames && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                Scegli un suggerimento o scrivi il testo che preferisci:
              </p>
              {(() => {
                const dateIT = date ? new Date(date).toLocaleDateString('it-IT') : '';
                const suggestions = [
                  [coupleName, 'Sposi', location, dateIT].filter(Boolean).join(' '),
                  [coupleName, dateIT].filter(Boolean).join(' — '),
                  ['W gli Sposi!', coupleName, dateIT].filter(Boolean).join(' '),
                ].filter(s => s.length > 0);
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {suggestions.map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setWatermarkText(s)}
                        style={{
                          padding: '0.35rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer',
                          borderRadius: '999px',
                          border: watermarkText === s ? '2px solid #d4a574' : '1px solid #ccc',
                          background: watermarkText === s ? '#faf3ec' : 'white',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                );
              })()}
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                maxLength={80}
                placeholder={`es. ${coupleName || 'Ciccia & Ciccio'} Sposi ${location || 'Palermo'} ${date ? new Date(date).toLocaleDateString('it-IT') : '06/07/2026'}`}
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
              />
              <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.35rem' }}>
                Se lasci vuoto verranno impressi nomi e data. Il logo Sposi.live è sempre presente.
              </p>
            </div>
          )}
        </div>
        {error && <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 2rem', fontSize: '1rem', cursor: 'pointer' }}>
          {loading ? 'Creazione...' : 'Crea evento'}
        </button>
      </form>

      {showDriveStep && (
        <div style={{ marginTop: '2rem', padding: '1.5rem', border: '2px solid #d4a574', borderRadius: '8px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>Evento creato! ✅</h2>
          <p style={{ marginBottom: '1.5rem', color: '#555' }}>
            Ora collega Google Drive per il backup automatico delle foto.
            Così non perderai mai i ricordi del tuo matrimonio.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={handleConnectDrive} style={{ padding: '0.75rem 2rem', fontSize: '1rem', cursor: 'pointer', background: '#d4a574', color: 'white', border: 'none', borderRadius: '4px' }}>
              Connetti Google Drive
            </button>
            <button onClick={handleSkipDrive} style={{ padding: '0.75rem 2rem', fontSize: '1rem', cursor: 'pointer', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px' }}>
              Salta (lo farò dopo)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
