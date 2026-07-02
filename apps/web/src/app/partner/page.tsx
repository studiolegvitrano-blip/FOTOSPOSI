'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPartners, type MarketplaceSupplier } from '@fotosposi/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export default function PartnerListPage() {
  const [partners, setPartners] = useState<MarketplaceSupplier[]>([]);
  const [category, setCategory] = useState('');

  useEffect(() => { loadPartners(); }, [category]);

  const loadPartners = async () => {
    const { suppliers } = await getPartners(category || undefined);
    if (suppliers) setPartners(suppliers);
  };

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Sconti per gli sposi</h1>
      <p className="text-text-muted">Mostra l'app FotoSposi ai partner e ottieni sconti esclusivi per il tuo matrimonio.</p>

      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <Button key={c.key} variant={category === c.key ? 'default' : 'outline'} size="sm" onClick={() => setCategory(c.key)}>
            {c.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {partners.map(p => (
          <Card key={p.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant="outline" className="mt-1">{p.category}</Badge>
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
        {partners.length === 0 && (
          <p className="col-span-3 text-center text-text-muted py-8">Nessun partner trovato in questa categoria.</p>
        )}
      </div>
    </main>
  );
}
