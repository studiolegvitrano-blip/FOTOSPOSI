'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSuppliers, getAvgRating } from '@fotosposi/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Handshake, ShieldCheck, BadgeCheck } from 'lucide-react';

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
    <main className="mx-auto max-w-5xl px-4 py-10 space-y-10">
      {/* Hero elegante */}
      <section className="text-center space-y-4 py-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-text-muted">
          <Sparkles className="h-3.5 w-3.5" />
          Rete Sposi.live
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Professionisti convenzionati</h1>
        <p className="mx-auto max-w-2xl text-text-muted">
          I migliori professionisti del settore wedding, selezionati per la qualità del lavoro.
          Condizioni esclusive pensate per chi organizza il proprio matrimonio.
        </p>
        <div className="flex items-center justify-center gap-2 pt-2 text-xs text-text-muted flex-wrap">
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Professionisti selezionati</span>
          <span className="text-border">•</span>
          <span className="inline-flex items-center gap-1"><Handshake className="h-3.5 w-3.5" /> Condizioni dedicate agli sposi</span>
        </div>
      </section>

      {loading ? (
        <p className="text-center text-text-muted">Caricamento...</p>
      ) : suppliers.length === 0 ? (
        // Stato vuoto elegante: la rete sta crescendo, invito a unirsi.
        <section className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-8 sm:p-10 text-center space-y-5 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
            <BadgeCheck className="h-7 w-7 text-brand" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">La rete dei professionisti sta crescendo</h2>
            <p className="text-sm text-text-muted">
              Stiamo selezionando i migliori fornitori per il tuo matrimonio: fotografi, catering,
              location e molto altro. Presto troverai qui le proposte con condizioni esclusive.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button variant="outline" asChild>
              <Link href="/partner">Sconti per gli sposi</Link>
            </Button>
            <Button asChild>
              <Link href="/collaboratori">Diventa professionista convenzionato</Link>
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant={category === '' ? 'default' : 'outline'} size="sm" onClick={() => setCategory('')}>Tutti</Button>
            {CATEGORIES.map(c => (
              <Button key={c} variant={category === c ? 'default' : 'outline'} size="sm" onClick={() => setCategory(c)} className="capitalize">{c}</Button>
            ))}
          </div>

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
          </div>
        </>
      )}
    </main>
  );
}
