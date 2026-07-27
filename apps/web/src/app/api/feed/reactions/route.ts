import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSideClient, createServiceClient } from '@fotosposi/core';

const REACTIONS = ['like', 'love', 'adore', 'wow', 'sigh', 'grrr'] as const;
type ReactionType = (typeof REACTIONS)[number];

/**
 * GET /api/feed/reactions?event_id=<uuid>&media_ids=<csv>
 *   → { [media_id]: { counts: {like:n, ...}, myReaction?: ReactionType } }
 *
 * POST /api/feed/reactions { event_id, media_id, reaction }
 *   → upsert sulla riga (media_id, user_id). Se reaction === null → DELETE.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const eventId = sp.get('event_id');
  const mediaIds = (sp.get('media_ids') || '').split(',').filter(Boolean);
  if (!eventId || mediaIds.length === 0) {
    return NextResponse.json({ error: 'event_id and media_ids required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: rows } = await supabase
    .from('feed_reactions')
    .select('media_id, reaction, user_id')
    .eq('event_id', eventId)
    .in('media_id', mediaIds);

  // utente corrente opzionale (se loggato)
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const ssr = createServerSideClient(() => cookieStore.getAll());
    const { data } = await ssr.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {
    // public access ok
  }

  const out: Record<string, { counts: Partial<Record<ReactionType, number>>; myReaction?: ReactionType }> = {};
  for (const id of mediaIds) out[id] = { counts: {} };
  for (const r of rows ?? []) {
    const counts = out[r.media_id]?.counts;
    if (counts) counts[r.reaction as ReactionType] = (counts[r.reaction as ReactionType] || 0) + 1;
    if (userId && r.user_id === userId) {
      const entry = out[r.media_id];
      if (entry) entry.myReaction = r.reaction as ReactionType;
    }
  }
  return NextResponse.json(out);
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const ssr = createServerSideClient(() => cookieStore.getAll());
    const { data } = await ssr.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch {}
  if (!userId) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.event_id || !body.media_id) {
    return NextResponse.json({ error: 'event_id and media_id required' }, { status: 400 });
  }
  const reaction = body.reaction ?? null;
  if (reaction !== null && !REACTIONS.includes(reaction)) {
    return NextResponse.json({ error: 'invalid reaction' }, { status: 400 });
  }

  const supabase = createServiceClient();
  if (reaction === null) {
    await supabase
      .from('feed_reactions')
      .delete()
      .eq('event_id', body.event_id)
      .eq('media_id', body.media_id)
      .eq('user_id', userId);
    return NextResponse.json({ ok: true, action: 'deleted' });
  }

  const { error } = await supabase
    .from('feed_reactions')
    .upsert(
      { event_id: body.event_id, media_id: body.media_id, user_id: userId, reaction },
      { onConflict: 'media_id,user_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, action: 'upserted' });
}
