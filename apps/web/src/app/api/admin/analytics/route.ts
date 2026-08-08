import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ceoGate(req: NextRequest): NextResponse | null {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!verifyCeoSession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * GET /api/admin/analytics
 *
 * Aggregazione analytics GLOBALE (no tenant filter). Le funzioni
 * @fotosposi/analytics richiedono tenant_id; per la dashboard CEO aggreghiamo
 * su tutti gli eventi con query dirette service-role.
 */
export async function GET(req: NextRequest) {
  const blocked = ceoGate(req);
  if (blocked) return blocked;

  try {
    const svc = createServiceClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [
      { data: events },
      { data: media },
      { data: orders },
      { data: votes },
      { data: jokeEntries },
      { data: shares },
      { data: sitesPublished },
      { data: eventsActivated48h },
      { data: suppliers },
    ] = await Promise.all([
      svc.from('events').select('id, tier, created_at, status'),
      svc.from('media_uploads').select('id, type, event_id, uploaded_by'),
      svc.from('orders').select('id, amount, status'),
      svc.from('votes').select('id, event_id'),
      svc.from('joke_entries').select('id, event_id'),
      svc.from('social_shares').select('id, medium, content_type, clickback, created_at'),
      svc.from('site_drafts').select('event_id, published, updated_at').eq('published', true),
      svc.from('site_drafts').select('event_id, updated_at').gte('updated_at', fortyEightHAgo),
      svc.from('marketplace_suppliers').select('id, approved, contacted_at, active'),
    ]);

    const eventsArr = (events ?? []) as Array<{ id: string; tier: string; created_at: string }>;
    const mediaArr = (media ?? []) as Array<{ type: string; event_id: string; uploaded_by: string }>;
    const ordersArr = (orders ?? []) as Array<{ amount: number; status: string }>;
    const votesArr = (votes ?? []) as Array<{ event_id: string }>;
    const jokesArr = (jokeEntries ?? []) as Array<{ event_id: string }>;
    const sharesArr = (shares ?? []) as Array<{ medium: string; content_type: string; clickback: boolean }>;
    const sitesPub = (sitesPublished ?? []) as Array<{ event_id: string }>;
    const sites48h = (eventsActivated48h ?? []) as Array<{ event_id: string; updated_at: string }>;
    const suppliersArr = (suppliers ?? []) as Array<{ approved: boolean; contacted_at: string | null; active: boolean }>;

    // Overview
    const eventsByTier: Record<string, number> = {};
    for (const e of eventsArr) eventsByTier[e.tier ?? 'free'] = (eventsByTier[e.tier ?? 'free'] ?? 0) + 1;

    // Activation
    const totalEvents = eventsArr.length;
    const eventsWithSite = new Set(sitesPub.map((s) => s.event_id)).size;
    const events48h = new Set(sites48h.map((s) => s.event_id)).size;
    const activationRateOverall = totalEvents > 0 ? Math.round((eventsWithSite / totalEvents) * 1000) / 10 : 0;
    const activationRate48h = totalEvents > 0 ? Math.round((events48h / totalEvents) * 1000) / 10 : 0;

    // Engagement per event
    const eventIds = eventsArr.map((e) => e.id);
    const engagement = eventIds.map((eid) => {
      const totalUsers = new Set(mediaArr.filter((m) => m.event_id === eid).map((m) => m.uploaded_by)).size
        + new Set(votesArr.filter((v) => v.event_id === eid).map((v) => v as unknown as string)).size;
      const usersWithUpload = new Set(mediaArr.filter((m) => m.event_id === eid).map((m) => m.uploaded_by)).size;
      const usersWithVote = votesArr.filter((v) => v.event_id === eid).length;
      const usersWithGame = new Set(jokesArr.filter((j) => j.event_id === eid).map((j) => j as unknown as string)).size;
      const engagedUsers = new Set([
        ...mediaArr.filter((m) => m.event_id === eid).map((m) => m.uploaded_by),
      ]).size;
      const total = usersWithUpload + usersWithVote + usersWithGame;
      const engagementRate = total > 0 ? Math.round((engagedUsers / Math.max(total, 1)) * 1000) / 10 : 0;
      return {
        event_id: eid,
        total_users: totalUsers,
        users_with_upload: usersWithUpload,
        users_with_vote: usersWithVote,
        users_with_game_participation: usersWithGame,
        engaged_users: engagedUsers,
        engagement_rate: engagementRate,
      };
    });

    // Viral
    const totalShares = sharesArr.length;
    const totalClickbacks = sharesArr.filter((s) => s.clickback).length;
    const viralCoefficient = totalShares > 0 ? Math.round((totalClickbacks / totalShares) * 1000) / 10 : 0;
    const sharesByMedium: Record<string, number> = {};
    const sharesByContent: Record<string, number> = {};
    for (const s of sharesArr) {
      sharesByMedium[s.medium] = (sharesByMedium[s.medium] ?? 0) + 1;
      sharesByContent[s.content_type] = (sharesByContent[s.content_type] ?? 0) + 1;
    }

    // B2B
    const totalSuppliers = suppliersArr.length;
    const contacted = suppliersArr.filter((s) => s.contacted_at !== null).length;
    const approved = suppliersArr.filter((s) => s.approved).length;
    const active = suppliersArr.filter((s) => s.active).length;
    const contactRate = totalSuppliers > 0 ? Math.round((contacted / totalSuppliers) * 1000) / 10 : 0;
    const approvalRate = contacted > 0 ? Math.round((approved / contacted) * 1000) / 10 : 0;
    const activeRate = approved > 0 ? Math.round((active / approved) * 1000) / 10 : 0;

    return NextResponse.json({
      data: {
        event_count: totalEvents,
        total_uploads: mediaArr.length,
        total_photos: mediaArr.filter((m) => m.type === 'photo').length,
        total_videos: mediaArr.filter((m) => m.type === 'video').length,
        total_orders: ordersArr.length,
        total_revenue: ordersArr.filter((o) => o.status === 'paid').reduce((s, o) => s + (o.amount || 0), 0),
        total_votes: votesArr.length,
        total_jokes: jokesArr.length,
        total_guests: 0,
        events_by_tier: eventsByTier,
      },
      activation: {
        total_events: totalEvents,
        events_with_site: eventsWithSite,
        events_activated_48h: events48h,
        activation_rate_48h: activationRate48h,
        activation_rate_overall: activationRateOverall,
      },
      engagement,
      viral: {
        total_shares: totalShares,
        total_clickbacks: totalClickbacks,
        viral_coefficient: viralCoefficient,
        shares_by_medium: sharesByMedium,
        shares_by_content: sharesByContent,
      },
      b2b: {
        total_suppliers: totalSuppliers,
        contacted,
        approved,
        active,
        contact_rate: contactRate,
        approval_rate: approvalRate,
        active_rate: activeRate,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}
