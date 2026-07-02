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

export interface EngagementMetrics {
  event_id: string;
  total_users: number;
  users_with_upload: number;
  users_with_vote: number;
  users_with_game_participation: number;
  engaged_users: number;
  engagement_rate: number;
}

export interface ViralMetrics {
  total_shares: number;
  total_clickbacks: number;
  viral_coefficient: number;
  shares_by_medium: Record<string, number>;
  shares_by_content: Record<string, number>;
}

export interface ActivationMetrics {
  total_events: number;
  events_with_site: number;
  events_activated_48h: number;
  activation_rate_48h: number;
  activation_rate_overall: number;
}

export interface B2BConversionMetrics {
  total_suppliers: number;
  contacted: number;
  approved: number;
  active: number;
  contact_rate: number;
  approval_rate: number;
  active_rate: number;
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

export async function getActivationMetrics(tenantId: string): Promise<{ data?: ActivationMetrics; error?: string }> {
  const supabase = createServiceClient();

  const { data: events, error: evtErr } = await supabase
    .from('events')
    .select('id, created_at')
    .eq('tenant_id', tenantId);
  if (evtErr) return { error: evtErr.message };

  const eventIds = (events ?? []).map((e: { id: string }) => e.id);
  if (eventIds.length === 0) {
    return { data: { total_events: 0, events_with_site: 0, events_activated_48h: 0, activation_rate_48h: 0, activation_rate_overall: 0 } };
  }

  const { data: drafts } = await supabase
    .from('site_drafts')
    .select('event_id, published, updated_at')
    .in('event_id', eventIds)
    .eq('published', true);

  const draftMap = new Map<string, string>();
  for (const d of drafts ?? []) {
    draftMap.set(d.event_id, d.updated_at);
  }

  let eventsWithSite = 0;
  let eventsActivated48h = 0;

  for (const evt of events ?? []) {
    const publishedAt = draftMap.get(evt.id);
    if (publishedAt) {
      eventsWithSite++;
      const created = new Date(evt.created_at).getTime();
      const published = new Date(publishedAt).getTime();
      const hoursDiff = (published - created) / (1000 * 60 * 60);
      if (hoursDiff >= 0 && hoursDiff <= 48) {
        eventsActivated48h++;
      }
    }
  }

  return {
    data: {
      total_events: events!.length,
      events_with_site: eventsWithSite,
      events_activated_48h: eventsActivated48h,
      activation_rate_48h: events!.length > 0 ? Math.round((eventsActivated48h / events!.length) * 100) : 0,
      activation_rate_overall: events!.length > 0 ? Math.round((eventsWithSite / events!.length) * 100) : 0,
    },
  };
}

export async function getEngagementMetrics(tenantId: string): Promise<{ data?: EngagementMetrics[]; error?: string }> {
  const supabase = createServiceClient();

  const { data: events, error: evtErr } = await supabase
    .from('events')
    .select('id')
    .eq('tenant_id', tenantId);
  if (evtErr) return { error: evtErr.message };

  const eventIds = (events ?? []).map((e: { id: string }) => e.id);
  if (eventIds.length === 0) return { data: [] };

  const [mediaRes, votesRes, jokesRes, photoHuntRes, dressVoteRes] = await Promise.all([
    supabase.from('media_uploads').select('event_id, uploaded_by').in('event_id', eventIds),
    supabase.from('votes').select('event_id, voter_id').in('event_id', eventIds),
    supabase.from('joke_entries').select('event_id, from_user').in('event_id', eventIds),
    supabase.from('photo_hunt_registrations').select('event_id, id').in('event_id', eventIds),
    supabase.from('dress_votes').select('event_id, voter_id').in('event_id', eventIds),
  ]);

  const usersByEvent = new Map<string, Set<string>>();
  const uploadUsersByEvent = new Map<string, Set<string>>();
  const voteUsersByEvent = new Map<string, Set<string>>();
  const gameUsersByEvent = new Map<string, Set<string>>();

  for (const evt of events ?? []) {
    usersByEvent.set(evt.id, new Set());
    uploadUsersByEvent.set(evt.id, new Set());
    voteUsersByEvent.set(evt.id, new Set());
    gameUsersByEvent.set(evt.id, new Set());
  }

  for (const m of mediaRes.data ?? []) {
    uploadUsersByEvent.get(m.event_id)?.add(m.uploaded_by);
    usersByEvent.get(m.event_id)?.add(m.uploaded_by);
  }
  for (const v of votesRes.data ?? []) {
    voteUsersByEvent.get(v.event_id)?.add(v.voter_id);
    usersByEvent.get(v.event_id)?.add(v.voter_id);
  }
  for (const j of jokesRes.data ?? []) {
    usersByEvent.get(j.event_id)?.add(j.from_user);
  }
  for (const d of dressVoteRes.data ?? []) {
    gameUsersByEvent.get(d.event_id)?.add(d.voter_id);
    usersByEvent.get(d.event_id)?.add(d.voter_id);
  }
  for (const p of photoHuntRes.data ?? []) {
    usersByEvent.get(p.event_id)?.add(p.id);
    gameUsersByEvent.get(p.event_id)?.add(p.id);
  }

  const results: EngagementMetrics[] = [];
  for (const evt of events ?? []) {
    const total = usersByEvent.get(evt.id)?.size ?? 0;
    const uploaded = uploadUsersByEvent.get(evt.id)?.size ?? 0;
    const voted = voteUsersByEvent.get(evt.id)?.size ?? 0;
    const games = gameUsersByEvent.get(evt.id)?.size ?? 0;
    const engaged = new Set([...uploadUsersByEvent.get(evt.id) ?? [], ...voteUsersByEvent.get(evt.id) ?? [], ...gameUsersByEvent.get(evt.id) ?? []]).size;
    results.push({
      event_id: evt.id,
      total_users: total,
      users_with_upload: uploaded,
      users_with_vote: voted,
      users_with_game_participation: games,
      engaged_users: engaged,
      engagement_rate: total > 0 ? Math.round((engaged / total) * 100) : 0,
    });
  }

  return { data: results };
}

export async function getViralMetrics(tenantId: string): Promise<{ data?: ViralMetrics; error?: string }> {
  const supabase = createServiceClient();

  const { data: events, error: evtErr } = await supabase
    .from('events')
    .select('id')
    .eq('tenant_id', tenantId);
  if (evtErr) return { error: evtErr.message };

  const eventIds = (events ?? []).map((e: { id: string }) => e.id);
  if (eventIds.length === 0) {
    return { data: { total_shares: 0, total_clickbacks: 0, viral_coefficient: 0, shares_by_medium: {}, shares_by_content: {} } };
  }

  const { data: shares, error } = await supabase
    .from('social_shares')
    .select('medium, content_type, clicked_back')
    .in('event_id', eventIds);
  if (error) return { error: error.message };

  const byMedium: Record<string, number> = {};
  const byContent: Record<string, number> = {};
  let clickbacks = 0;

  for (const s of shares ?? []) {
    byMedium[s.medium] = (byMedium[s.medium] || 0) + 1;
    byContent[s.content_type] = (byContent[s.content_type] || 0) + 1;
    if (s.clicked_back) clickbacks++;
  }

  const total = shares?.length ?? 0;
  return {
    data: {
      total_shares: total,
      total_clickbacks: clickbacks,
      viral_coefficient: total > 0 ? Math.round((clickbacks / total) * 100) : 0,
      shares_by_medium: byMedium,
      shares_by_content: byContent,
    },
  };
}

export async function getB2BConversionMetrics(tenantId: string): Promise<{ data?: B2BConversionMetrics; error?: string }> {
  const supabase = createServiceClient();

  const { data: suppliers, error } = await supabase.from('marketplace_suppliers').select('contacted_at, approved, active');
  if (error) return { error: error.message };

  const total = suppliers?.length ?? 0;
  const contacted = (suppliers ?? []).filter((s: any) => s.contacted_at != null).length;
  const approved = (suppliers ?? []).filter((s: any) => s.approved).length;
  const active = (suppliers ?? []).filter((s: any) => s.active).length;

  return {
    data: {
      total_suppliers: total,
      contacted,
      approved,
      active,
      contact_rate: total > 0 ? Math.round((contacted / total) * 100) : 0,
      approval_rate: total > 0 ? Math.round((approved / total) * 100) : 0,
      active_rate: total > 0 ? Math.round((active / total) * 100) : 0,
    },
  };
}
