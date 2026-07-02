'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPartners, calculateDistance, type MarketplaceSupplier } from '@fotosposi/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PiggyBank, MapPin, Navigation } from 'lucide-react';

const CATEGORIES = [
  { key: '', label: 'Tutti' },
  { key: 'fotografo', label: 'Fotografi' },
  { key: 'parrucchiere', label: 'Parrucchieri' },
  { key: 'estetista', label: 'Estetiste' },
  { key: 'makeup', label: 'Makeup Artist' },
  { key: 'autonoleggio', label: 'Auto Noleggio' },
  { key: 'location', label: 'Location' },
  { key: 'wedding_planner', label: 'Wedding Planner' },
  { key: 'abiti', label: 'Abiti da Sposa' },
  { key: 'animazione', label: 'Animazione' },
];

const RADIUS_KM = 140;

export default function PartnerListPage() {
  const [partners, setPartners] = useState<(MarketplaceSupplier & { distance?: number })[]>([]);
  const [category, setCategory] = useState('');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [radius, setRadius] = useState(RADIUS_KM);

  useEffect(() => { loadPartners(); }, [category]);

  const loadPartners = async () => {
    const { suppliers } = await getPartners(category || undefined);
    if (suppliers) setPartners(suppliers.map(s => ({ ...s })));
  };

  const requestLocation = () => {
    if (!navigator.geolocation) { setGeoError('Geolocalizzazione non supportata'); return; }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setGeoLoading(false); },
      (err) => { setGeoError('Impossibile ottenere la posizione'); setGeoLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const filtered = partners
    .filter(p => {
      if (!userLat || !userLng || !p.lat || !p.lng || p.category === 'servizio_consigliato') return true;
      p.distance = calculateDistance(userLat, userLng, p.lat, p.lng);
      return p.distance <= radius;
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sconti per gli sposi</h1>
          <p className="text-text-muted">Sconti esclusivi per sposi e invitati. Mostra l'app ai partner convenzionati e risparmia sul tuo matrimonio.</p>
        </div>
        <Button variant="outline" size="sm" asChild className="shrink-0">
          <Link href="/partner/servizi">
            <PiggyBank className="w-4 h-4 mr-1" />
            Servizi Consigliati
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {CATEGORIES.map(c => (
          <Button key={c.key} variant={category === c.key ? 'default' : 'outline'} size="sm" onClick={() => setCategory(c.key)}>
            {c.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {!userLat ? (
          <Button variant="secondary" size="sm" onClick={requestLocation} disabled={geoLoading}>
            <MapPin className="w-4 h-4 mr-1" />
            {geoLoading ? 'Rilevamento...' : 'Usa la mia posizione'}
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Navigation className="w-4 h-4 text-green-600" />
            <span className="text-green-700 font-medium">Posizione attiva</span>
            <label className="flex items-center gap-1 ml-2">
              <span className="text-xs">Raggio:</span>
              <select className="text-xs border rounded p-1" value={radius} onChange={e => setRadius(Number(e.target.value))}>
                <option value={50}>50 km</option>
                <option value={100}>100 km</option>
                <option value={140}>140 km</option>
                <option value={200}>200 km</option>
                <option value={99999}>Tutta Italia</option>
              </select>
            </label>
          </div>
        )}
        {geoError && <span className="text-xs text-red-600">{geoError}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{p.category}</Badge>
                    {p.distance !== undefined && p.distance <= radius && (
                      <span className="text-xs text-text-muted">{Math.round(p.distance)} km</span>
                    )}
                  </div>
                </div>
                {p.photo_url && <img src={p.photo_url} alt="" className="w-12 h-12 rounded-full object-cover" />}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {p.description && <p className="text-sm text-text-muted">{p.description}</p>}
              {p.discount_offer && (
                <p className="text-sm font-medium text-green-700 bg-green-50 p-2 rounded">
                  {p.discount_offer}
                </p>
              )}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-text-muted">{p.city || ''}</span>
                {p.slug && <Button size="sm" variant="link" asChild><Link href={`/partner/${p.slug}`}>Vedi offerta</Link></Button>}
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-3 text-center text-text-muted py-8">
            {userLat ? 'Nessun partner trovato nel raggio selezionato. Prova ad aumentare il raggio.' : 'Nessun partner trovato in questa categoria.'}
          </p>
        )}
      </div>
    </main>
  );
}
