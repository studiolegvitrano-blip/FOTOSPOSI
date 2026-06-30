'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getCurrentUser } from '@fotosposi/core';
import { getB2BAnalytics } from '@fotosposi/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function AnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      const supabase = createClient();
      supabase.from('core_users').select('tenant_id').eq('id', u.id).single().then(({ data: ud }) => {
        if (ud?.tenant_id) {
          getB2BAnalytics(ud.tenant_id).then(r => {
            if (r.data) setData(r.data);
            setLoading(false);
          });
        } else setLoading(false);
      });
    });
  }, [router]);

  if (loading) return <p className="text-center mt-8">Caricamento...</p>;

  const stats = [
    { label: 'Eventi', value: data?.event_count ?? 0 },
    { label: 'Foto', value: data?.total_photos ?? 0 },
    { label: 'Video', value: data?.total_videos ?? 0 },
    { label: 'Ordini', value: data?.total_orders ?? 0 },
    { label: 'Voti', value: data?.total_votes ?? 0 },
    { label: 'Scherzi', value: data?.total_jokes ?? 0 },
  ];

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics B2B</h1>
        <Button variant="outline" onClick={() => router.push('/admin')}>← Admin</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardHeader><CardTitle className="text-2xl text-center text-brand">{s.value}</CardTitle></CardHeader>
            <CardContent className="text-center text-sm text-text-muted pt-0">{s.label}</CardContent>
          </Card>
        ))}
      </div>

      {data?.total_revenue > 0 && (
        <Card>
          <CardHeader><CardTitle>Revenue totale</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-brand">&euro;{data.total_revenue.toFixed(2)}</p>
          </CardContent>
        </Card>
      )}

      {data?.events_by_tier && Object.keys(data.events_by_tier).length > 0 && (
        <Card>
          <CardHeader><CardTitle>Eventi per tier</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.events_by_tier as Record<string, number>).map(([tier, count]) => (
                <div key={tier} className="flex items-center justify-between">
                  <span className="capitalize">{tier}</span>
                  <span className="font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
