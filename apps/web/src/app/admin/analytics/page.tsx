'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { createClient, getCurrentUser } from '@fotosposi/core';
import { getB2BAnalytics, getActivationMetrics, getEngagementMetrics, getViralMetrics, getB2BConversionMetrics } from '@fotosposi/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function AnalyticsPage() {
  const t = useTranslations('analytics');
  const c = useTranslations('common');
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [activation, setActivation] = useState<any>(null);
  const [engagement, setEngagement] = useState<any[]>([]);
  const [viral, setViral] = useState<any>(null);
  const [b2b, setB2b] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      const supabase = createClient();
      supabase.from('core_users').select('tenant_id').eq('id', u.id).single().then(({ data: ud }) => {
        if (ud?.tenant_id) {
          Promise.all([
            getB2BAnalytics(ud.tenant_id),
            getActivationMetrics(ud.tenant_id),
            getEngagementMetrics(ud.tenant_id),
            getViralMetrics(ud.tenant_id),
            getB2BConversionMetrics(ud.tenant_id),
          ]).then(([a, act, eng, vir, b]) => {
            if (a.data) setData(a.data);
            if (act.data) setActivation(act.data);
            if (eng.data) setEngagement(eng.data);
            if (vir.data) setViral(vir.data);
            if (b.data) setB2b(b.data);
            setLoading(false);
          });
        } else setLoading(false);
      });
    });
  }, [router]);

  if (loading) return <p className="text-center mt-8">{c('loading')}</p>;

  const stats = [
    { label: t('events'), value: data?.event_count ?? 0 },
    { label: t('photos'), value: data?.total_photos ?? 0 },
    { label: t('videos'), value: data?.total_videos ?? 0 },
    { label: t('orders'), value: data?.total_orders ?? 0 },
    { label: t('votes'), value: data?.total_votes ?? 0 },
    { label: t('jokes'), value: data?.total_jokes ?? 0 },
  ];

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button variant="outline" onClick={() => router.push('/admin')}>← {c('back')}</Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('tab_overview')}</TabsTrigger>
          <TabsTrigger value="activation">{t('tab_activation')}</TabsTrigger>
          <TabsTrigger value="engagement">{t('tab_engagement')}</TabsTrigger>
          <TabsTrigger value="viral">{t('tab_viral')}</TabsTrigger>
          <TabsTrigger value="b2b">{t('tab_b2b')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
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
              <CardHeader><CardTitle>{t('total_revenue')}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-brand">&euro;{data.total_revenue.toFixed(2)}</p>
              </CardContent>
            </Card>
          )}

          {data?.events_by_tier && Object.keys(data.events_by_tier).length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t('events_by_tier')}</CardTitle></CardHeader>
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
        </TabsContent>

        <TabsContent value="activation" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{t('activation_title')}</CardTitle></CardHeader>
            <CardContent>
              {activation ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-brand">{activation.total_events}</p>
                    <p className="text-sm text-muted-foreground">{t('total_events')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-500">{activation.activation_rate_overall}%</p>
                    <p className="text-sm text-muted-foreground">{t('with_site_published')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-amber-500">{activation.activation_rate_48h}%</p>
                    <p className="text-sm text-muted-foreground">{t('activated_48h')}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold">{activation.events_with_site}</p>
                    <p className="text-sm text-muted-foreground">{t('sites_published')}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('no_data')}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          {engagement.length > 0 ? (
            <div className="grid gap-4">
              {engagement.map((e: any) => (
                <Card key={e.event_id}>
                  <CardHeader><CardTitle className="text-sm">{t('event_label')} {e.event_id.slice(0, 8)}...</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{e.total_users}</p>
                        <p className="text-xs text-muted-foreground">{t('total_users')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-500">{e.users_with_upload}</p>
                        <p className="text-xs text-muted-foreground">{t('users_with_upload')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-500">{e.users_with_vote}</p>
                        <p className="text-xs text-muted-foreground">{t('users_with_vote')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-pink-500">{e.users_with_game_participation}</p>
                        <p className="text-xs text-muted-foreground">{t('users_with_games')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-500">{e.engagement_rate}%</p>
                        <p className="text-xs text-muted-foreground">{t('engagement_rate_label')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent><p className="text-sm text-muted-foreground py-4">{t('no_engagement_data')}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="viral" className="space-y-4">
          {viral && viral.total_shares > 0 ? (
            <>
              <Card>
                <CardHeader><CardTitle>{t('viral_title')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-brand">{viral.total_shares}</p>
                      <p className="text-sm text-muted-foreground">{t('total_shares')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-500">{viral.total_clickbacks}</p>
                      <p className="text-sm text-muted-foreground">{t('total_clickbacks')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-500">{viral.viral_coefficient}%</p>
                      <p className="text-sm text-muted-foreground">{t('clickback_rate')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle>{t('shares_by_medium')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(viral.shares_by_medium as Record<string, number>).map(([medium, count]) => (
                        <div key={medium} className="flex items-center justify-between">
                          <span className="capitalize">{medium.replace('_', ' ')}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>{t('shares_by_content')}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(viral.shares_by_content as Record<string, number>).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className="capitalize">{type.replace('_', ' ')}</span>
                          <span className="font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardHeader><CardTitle>{t('viral_title')}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t('no_shares')}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="b2b" className="space-y-4">
          {b2b && b2b.total_suppliers > 0 ? (
            <Card>
              <CardHeader><CardTitle>{t('b2b_title')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{b2b.total_suppliers}</p>
                    <p className="text-xs text-muted-foreground">{t('total_suppliers')}</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{b2b.contacted}</p>
                    <p className="text-xs text-muted-foreground">{t('contacted')} ({b2b.contact_rate}%)</p>
                  </div>
                  <div className="text-center p-4 bg-amber-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{b2b.approved}</p>
                    <p className="text-xs text-muted-foreground">{t('approved')} ({b2b.approval_rate}%)</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{b2b.active}</p>
                    <p className="text-xs text-muted-foreground">{t('active')} ({b2b.active_rate}%)</p>
                  </div>
                  <div className="text-center p-4 col-span-2 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-brand">{b2b.active_rate}%</p>
                    <p className="text-xs text-muted-foreground">{t('b2b_conversion')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>{t('b2b_title')}</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t('no_suppliers')}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
