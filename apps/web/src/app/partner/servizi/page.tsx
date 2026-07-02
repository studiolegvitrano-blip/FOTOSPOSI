'use client';

import { useEffect, useState } from 'react';
import { getPartners, type MarketplaceSupplier } from '@fotosposi/marketplace';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, PiggyBank, ShieldCheck, ShoppingBag, Plane, Zap, Car } from 'lucide-react';

const GROUP_ORDER = ['Fintech / Banche', 'Assicurazioni Viaggio', 'E-commerce', 'Viaggi', 'Utility / SaaS', 'Autonoleggi'] as const;

const GROUP_KEYWORDS: Record<string, string[]> = {
  'Fintech / Banche': ['Revolut', 'ING', 'UniCredit', 'Tot', 'Vivid', 'Wise', 'BNL'],
  'Assicurazioni Viaggio': ['Columbus', 'IATI', 'World Nomads'],
  'E-commerce': ['Amazon', 'Shopify'],
  'Viaggi': ['Booking', 'Expedia', 'Airbnb'],
  'Utility / SaaS': ['Enel', 'Vodafone', 'Semrush', 'WP Engine'],
  'Autonoleggi': ['Rentalcars', 'Hertz', 'Avis', 'Europcar'],
};

const GROUP_ICONS: Record<string, React.ReactNode> = {
  'Fintech / Banche': <PiggyBank className="w-5 h-5" />,
  'Assicurazioni Viaggio': <ShieldCheck className="w-5 h-5" />,
  'E-commerce': <ShoppingBag className="w-5 h-5" />,
  'Viaggi': <Plane className="w-5 h-5" />,
  'Utility / SaaS': <Zap className="w-5 h-5" />,
  'Autonoleggi': <Car className="w-5 h-5" />,
};

function groupServices(services: MarketplaceSupplier[]): Record<string, MarketplaceSupplier[]> {
  const groups: Record<string, MarketplaceSupplier[]> = {};
  for (const s of services) {
    const group = GROUP_ORDER.find(g => (GROUP_KEYWORDS[g] ?? []).some(kw => s.name.includes(kw))) ?? 'Altro';
    if (!groups[group]) groups[group] = [];
    groups[group].push(s);
  }
  return groups;
}

export default function ServiziPage() {
  const [services, setServices] = useState<MarketplaceSupplier[]>([]);

  useEffect(() => {
    getPartners('servizio_consigliato').then(({ suppliers }) => {
      if (suppliers) setServices(suppliers);
    });
  }, []);

  const grouped = groupServices(services);

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Servizi Consigliati per gli Sposi</h1>
        <p className="text-text-muted mt-1">
          Apri un conto, attiva un'offerta o prenota un viaggio tramite i nostri link.
          Ricevi bonus e sconti esclusivi — e sostieni FotoSposi con una piccola commissione. Zero costi per te.
        </p>
      </div>

      {GROUP_ORDER.filter(g => grouped[g]?.length).map(group => (
        <section key={group} className="space-y-3">
          <div className="flex items-center gap-2 border-b pb-2">
            {GROUP_ICONS[group]}
            <h2 className="text-lg font-semibold">{group}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped[group]?.map(s => (
              <Card key={s.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{s.name}</CardTitle>
                    <Badge variant="secondary" className="text-xs">Consigliato</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 flex-1 flex flex-col">
                  {s.description && <p className="text-sm text-text-muted flex-1">{s.description}</p>}
                  {s.discount_offer && (
                    <p className="text-sm font-medium text-green-700 bg-green-50 p-2 rounded">
                      🎁 {s.discount_offer}
                    </p>
                  )}
                  {s.commission_info && (
                    <p className="text-xs text-text-muted">
                      💰 {s.commission_info}
                    </p>
                  )}
                  {s.affiliate_link && (
                    <Button size="sm" className="w-full mt-auto" asChild>
                      <a href={s.affiliate_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Vedi offerta
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
