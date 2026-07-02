'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getPartnerBySlug, logPartnerVisit, type MarketplaceSupplier } from '@fotosposi/marketplace';
import { createClient } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PartnerDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [partner, setPartner] = useState<MarketplaceSupplier | null>(null);
  const [error, setError] = useState('');
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getPartnerBySlug(slug).then(({ supplier, error: e }) => {
      if (e) setError(e);
      if (supplier) setPartner(supplier);
    });
  }, [slug]);

  const handleScan = async () => {
    if (!partner) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await logPartnerVisit({
      supplier_id: partner.id,
      user_id: user?.id,
      source: 'qr',
    });
    setScanned(true);
  };

  if (error) return <main className="max-w-3xl mx-auto p-4"><p className="text-red-600">{error}</p></main>;
  if (!partner) return <main className="max-w-3xl mx-auto p-4"><p>Caricamento...</p></main>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{partner.name}</CardTitle>
              <Badge variant="outline" className="mt-1">{partner.category}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {partner.description && <p>{partner.description}</p>}
          {partner.city && <p className="text-sm text-text-muted">📍 {partner.city}</p>}

          {partner.discount_offer && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <h3 className="font-bold text-green-800">Offerta speciale per te</h3>
              <p className="text-green-700 mt-1">{partner.discount_offer}</p>
            </div>
          )}

          {!scanned ? (
            <Button onClick={handleScan} className="w-full">
              Mostra questo schermo al fornitore per attivare lo sconto
            </Button>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-green-700 font-bold">✓ Scan registrato!</p>
              <p className="text-sm text-text-muted">
                Mostra questo schermo al fornitore per ottenere lo sconto.
                Se acquisterai, il fornitore verrà confermato.
              </p>
            </div>
          )}

          <div className="text-xs text-text-muted text-center pt-4">
            <p>Come funziona: mostra l'app al fornitore → scan QR → ottieni sconto.</p>
            <p>Il fornitore guadagna visibilità gratuita, tu risparmi. Tutti felici.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
