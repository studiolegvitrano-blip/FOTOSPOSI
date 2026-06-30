'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSuppliers, getAvgRating } from '@fotosposi/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = ['fotografo', 'catering', 'fiori', 'musica', 'location', 'abiti', 'torte', 'video', 'altro'];

export default function MarketplacePage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [category, setCategory] = useState<string>('');
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuppliers();
  }, [category]);

  const loadSuppliers = async () => {
    setLoading(true);
    const r = await getSuppliers(category || undefined);
    if (r.suppliers) {
      setSuppliers(r.suppliers);
      const rs: Record<string, any> = {};
      for (const s of r.suppliers) {
        rs[s.id] = await getAvgRating(s.id);
      }
      setRatings(rs);
    }
    setLoading(false);
  };

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Fornitori per matrimonio</h1>
      <p className="text-text-muted">Trova i migliori professionisti per il tuo evento</p>

      <div className="flex flex-wrap gap-2">
        <Button variant={category === '' ? 'default' : 'outline'} size="sm" onClick={() => setCategory('')}>Tutti</Button>
        {CATEGORIES.map(c => (
          <Button key={c} variant={category === c ? 'default' : 'outline'} size="sm" onClick={() => setCategory(c)} className="capitalize">{c}</Button>
        ))}
      </div>

      {loading ? <p className="text-center text-text-muted">Caricamento...</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(s => {
            const r = ratings[s.id];
            return (
              <Card key={s.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <Badge variant="outline" className="capitalize">{s.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {s.description && <p className="text-sm text-text-muted">{s.description}</p>}
                  {s.city && <p className="text-xs text-text-muted">{s.city}</p>}
                  {r && r.count > 0 && <p className="text-sm">{'★'.repeat(Math.round(r.avg))} ({r.count} recensioni)</p>}
                  <div className="flex gap-2 pt-2">
                    {s.website && <Button variant="outline" size="sm" asChild><a href={s.website} target="_blank">Sito</a></Button>}
                    {s.email && <Button variant="outline" size="sm" asChild><a href={`mailto:${s.email}`}>Email</a></Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {suppliers.length === 0 && <p className="col-span-full text-center text-text-muted py-8">Nessun fornitore trovato</p>}
        </div>
      )}
    </main>
  );
}
