import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSideClient, createServiceClient } from '@fotosposi/core';

/**
 * GET /api/feed/comments?event_id=<uuid>&media_id=<uuid>
 *   → { comments: [{ id, author, text, created_at }] }
 *
 * POST /api/feed/comments { event_id, media_id, text }
 *   → { comment: { id, author, text, created_at } }
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const eventId = sp.get('event_id');
  const mediaId = sp.get('media_id');
  if (!eventId || !mediaId) {
    return NextResponse.json({ error: 'event_id and media_id required' }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from('feed_comments')
    .select('id, author_name, text, created_at')
    .eq('event_id', eventId)
    .eq('media_id', mediaId)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const comments = (rows ?? []).map((r: { id: string; author_name: string; text: string; created_at: string }) => ({
    id: r.id,
    author: r.author_name,
    text: r.text,
    created_at: r.created_at,
  }));
  return NextResponse.json({ comments });
}

export async function POST(req: NextRequest) {
  let userId: string | null = null;
  let userMetadata: Record<string, unknown> = {};
  let userEmail: string | null = null;
  try {
    const cookieStore = await cookies();
    const ssr = createServerSideClient(() => cookieStore.getAll());
    const { data } = await ssr.auth.getUser();
    userId = data?.user?.id ?? null;
    userMetadata = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
    userEmail = data?.user?.email ?? null;
  } catch {}
  if (!userId) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || !body.event_id || !body.media_id || !body.text) {
    return NextResponse.json({ error: 'event_id, media_id and text required' }, { status: 400 });
  }
  const text = String(body.text).trim().slice(0, 500);
  if (!text) return NextResponse.json({ error: 'text vuoto' }, { status: 400 });

  const authorName = (userMetadata.name as string) || (userEmail?.split('@')[0] ?? 'Ospite');

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('feed_comments')
    .insert({
      event_id: body.event_id,
      media_id: body.media_id,
      user_id: userId,
      author_name: authorName,
      text,
    })
    .select('id, author_name, text, created_at')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 });
  return NextResponse.json({
    comment: {
      id: data.id,
      author: data.author_name,
      text: data.text,
      created_at: data.created_at,
    },
  });
}
