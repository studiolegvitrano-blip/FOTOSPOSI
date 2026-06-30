import { createServiceClient } from '@fotosposi/core';

export interface AnalyticsSnapshot {
  event_count: number;
  total_uploads: number;
  total_photos: number;
  total_videos: number;
  total_orders: number;
  total_revenue: number;
  total_votes: number;
  total_jokes: number;
  total_guests: number;
  events_by_tier: Record<string, number>;
}

export async function getEventAnalytics(eventId: string): Promise<{ data?: AnalyticsSnapshot; error?: string }> {
  const supabase = createServiceClient();

  const [mediaRes, ordersRes, votesRes, jokesRes, eventRes] = await Promise.all([
    supabase.from('media_uploads').select('id, type').eq('event_id', eventId),
    supabase.from('orders').select('id, amount').eq('event_id', eventId),
    supabase.from('votes').select('id').eq('event_id', eventId),
    supabase.from('joke_entries').select('id').eq('event_id', eventId),
    supabase.from('events').select('tier').eq('id', eventId).single(),
  ]);

  const uploads: { type: string }[] = mediaRes.data ?? [];
  const orders: { amount: number }[] = ordersRes.data ?? [];

  return {
    data: {
      event_count: 1,
      total_uploads: uploads.length,
      total_photos: uploads.filter(m => m.type === 'photo').length,
      total_videos: uploads.filter(m => m.type === 'video').length,
      total_orders: orders.length,
      total_revenue: orders.reduce((s, o) => s + (o.amount || 0), 0),
      total_votes: votesRes.data?.length ?? 0,
      total_jokes: jokesRes.data?.length ?? 0,
      total_guests: 0,
      events_by_tier: eventRes.data ? { [eventRes.data.tier]: 1 } : {},
    },
  };
}

export async function getB2BAnalytics(tenantId: string): Promise<{ data?: AnalyticsSnapshot; error?: string }> {
  const supabase = createServiceClient();

  const { data: events } = await supabase.from('events').select('id, tier').eq('tenant_id', tenantId);
  const eventIds = (events ?? []).map((e: { id: string }) => e.id);

  if (eventIds.length === 0) {
    return { data: { event_count: 0, total_uploads: 0, total_photos: 0, total_videos: 0, total_orders: 0, total_revenue: 0, total_votes: 0, total_jokes: 0, total_guests: 0, events_by_tier: {} } };
  }

  const [mediaRes, ordersRes, votesRes, jokesRes] = await Promise.all([
    supabase.from('media_uploads').select('id, type').in('event_id', eventIds),
    supabase.from('orders').select('id, amount').in('event_id', eventIds),
    supabase.from('votes').select('id').in('event_id', eventIds),
    supabase.from('joke_entries').select('id').in('event_id', eventIds),
  ]);

  const uploads: { type: string }[] = mediaRes.data ?? [];
  const orders: { amount: number }[] = ordersRes.data ?? [];

  const tiers: Record<string, number> = {};
  (events ?? []).forEach((e: { tier: string }) => { tiers[e.tier] = (tiers[e.tier] || 0) + 1; });

  return {
    data: {
      event_count: events?.length ?? 0,
      total_uploads: uploads.length,
      total_photos: uploads.filter(m => m.type === 'photo').length,
      total_videos: uploads.filter(m => m.type === 'video').length,
      total_orders: orders.length,
      total_revenue: orders.reduce((s, o) => s + (o.amount || 0), 0),
      total_votes: votesRes.data?.length ?? 0,
      total_jokes: jokesRes.data?.length ?? 0,
      total_guests: 0,
      events_by_tier: tiers,
    },
  };
}
