import { createServiceClient } from '@fotosposi/core';
import type { GuestWrapped } from './index';

export async function getGuestWrapped(
  eventId: string,
  guestId: string,
): Promise<{ wrapped?: GuestWrapped; error?: string }> {
  const supabase = createServiceClient();

  const [eventRes, userRes] = await Promise.all([
    supabase.from('events').select('couple_name, date, brand').eq('id', eventId).single(),
    supabase.from('core_users').select('name').eq('id', guestId).single(),
  ]);

  if (eventRes.error) return { error: eventRes.error.message };
  if (userRes.error) return { error: userRes.error.message };
  if (!eventRes.data || !userRes.data) return { error: 'Not found' };

  const { count: photoCount } = await supabase
    .from('media_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('uploaded_by', guestId);

  const { count: voteCount } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('voter_id', guestId);

  const { count: jokeCount } = await supabase
    .from('joke_entries')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('from_user', guestId);

  const { count: videoCount } = await supabase
    .from('video_messages')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('from_user', guestId);

  const { data: giftData } = await supabase
    .from('gift_registry_transactions')
    .select('amount')
    .eq('event_id', eventId)
    .eq('from_user', guestId);
  const giftTotal = (giftData ?? []).reduce((sum: number, t: { amount?: number | string }) => sum + Number(t.amount || 0), 0);

  const { data: mediaData } = await supabase
    .from('media_uploads')
    .select('created_at')
    .eq('event_id', eventId)
    .eq('uploaded_by', guestId)
    .order('created_at', { ascending: true });

  let firstUpload: string | null = null;
  let lastUpload: string | null = null;
  if (mediaData && mediaData.length > 0) {
    firstUpload = mediaData[0]?.created_at ?? null;
    lastUpload = mediaData[mediaData.length - 1]?.created_at ?? null;
  }

  const { data: tagData } = await supabase
    .from('face_tags')
    .select('user_id, media_id!inner()')
    .eq('user_id', guestId);
  const tagCount = tagData?.length ?? 0;

  const { data: allUploads } = await supabase
    .from('media_uploads')
    .select('uploaded_by, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  const uploadsByUser = new Map<string, { first: string; last: string; count: number }>();
  for (const u of (allUploads ?? []) as { uploaded_by: string; created_at: string }[]) {
    const entry = uploadsByUser.get(u.uploaded_by) ?? { first: u.created_at, last: u.created_at, count: 0 };
    if (u.created_at < entry.first) entry.first = u.created_at;
    if (u.created_at > entry.last) entry.last = u.created_at;
    entry.count++;
    uploadsByUser.set(u.uploaded_by, entry);
  }

  const sorted = [...uploadsByUser.entries()].sort((a, b) => a[1].first.localeCompare(b[1].first));
  const guestEntry = uploadsByUser.get(guestId);
  const photoCountVal = photoCount ?? 0;
  const isFirst = sorted[0]?.[0] === guestId && photoCountVal > 0;
  const isLast = sorted.length > 0 && sorted[sorted.length - 1]?.[0] === guestId && photoCountVal > 0;

  const badges: string[] = [];
  if (isFirst) badges.push('Primo a caricare');
  if (isLast) badges.push('Ultimo rimasto');

  const { data: allVotes } = await supabase
    .from('votes')
    .select('voter_id')
    .eq('event_id', eventId);
  const voteCounts = new Map<string, number>();
  for (const v of (allVotes ?? []) as { voter_id: string }[]) {
    voteCounts.set(v.voter_id, (voteCounts.get(v.voter_id) || 0) + 1);
  }
  const topVoter = [...voteCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topVoter?.[0] === guestId && (voteCount ?? 0) > 0) badges.push('Top votante');

  const { data: allTags } = await supabase
    .from('face_tags')
    .select('user_id');
  const tagCounts = new Map<string, number>();
  for (const t of (allTags ?? []) as { user_id: string }[]) {
    tagCounts.set(t.user_id, (tagCounts.get(t.user_id) || 0) + 1);
  }
  const topTagged = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topTagged?.[0] === guestId && tagCount > 0) badges.push('Più taggato');

  return {
    wrapped: {
      guestName: userRes.data.name,
      coupleName: eventRes.data.couple_name,
      eventDate: eventRes.data.date,
      brand: eventRes.data.brand as 'fotosposi' | 'weddingmoments',
      photoCount: photoCountVal,
      voteCount: voteCount ?? 0,
      tagCount,
      jokeCount: jokeCount ?? 0,
      videoCount: videoCount ?? 0,
      giftTotal,
      firstUpload,
      lastUpload,
      badges,
    },
  };
}
