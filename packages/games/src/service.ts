import { createServiceClient } from '@fotosposi/core';
import type { GameCategory, Vote, JokeEntry } from './index';

export async function createCategory(params: {
  event_id: string;
  name: string;
}): Promise<{ category?: GameCategory; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('game_categories')
    .insert({ event_id: params.event_id, name: params.name })
    .select()
    .single();
  if (error) return { error: error.message };
  return { category: data };
}

export async function getCategories(eventId: string): Promise<{ categories?: GameCategory[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('game_categories')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) return { error: error.message };
  return { categories: data ?? [] };
}

export async function castVote(params: {
  event_id: string;
  category_id: string;
  media_id: string;
  voter_id: string;
}): Promise<{ vote?: Vote; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('votes')
    .upsert(
      {
        event_id: params.event_id,
        category_id: params.category_id,
        media_id: params.media_id,
        voter_id: params.voter_id,
      },
      { onConflict: 'category_id, voter_id' },
    )
    .select()
    .single();
  if (error) return { error: error.message };
  return { vote: data };
}

export async function getLeaderboard(
  eventId: string,
  categoryId: string,
): Promise<{ leaderboard?: { media_id: string; url: string; votes: number }[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('votes')
    .select(`
      media_id,
      media_uploads!inner(url, type),
      count:media_id
    `)
    .eq('event_id', eventId)
    .eq('category_id', categoryId)
    .order('count', { ascending: false });

  if (error) return { error: error.message };

  const grouped = new Map<string, { media_id: string; url: string; votes: number }>();
  for (const row of data ?? []) {
    const mid = row.media_id as string;
    const current = grouped.get(mid) ?? { media_id: mid, url: '', votes: 0 };
    current.votes++;
    const media = row.media_uploads as unknown as { url: string };
    if (media?.url) current.url = media.url;
    grouped.set(mid, current);
  }

  return {
    leaderboard: Array.from(grouped.values())
      .sort((a, b) => b.votes - a.votes),
  };
}

export async function createJoke(params: {
  event_id: string;
  from_user: string;
  content: string;
  reveal_at: string;
}): Promise<{ joke?: JokeEntry; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('joke_entries')
    .insert(params)
    .select()
    .single();
  if (error) return { error: error.message };
  return { joke: data };
}

export async function getJokes(
  eventId: string,
  revealed = true,
): Promise<{ jokes?: JokeEntry[]; error?: string }> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();
  let query = supabase
    .from('joke_entries')
    .select('*')
    .eq('event_id', eventId);

  if (revealed) {
    query = query.lte('reveal_at', now);
  } else {
    query = query.gt('reveal_at', now);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return { error: error.message };
  return { jokes: data ?? [] };
}

export async function deleteJoke(jokeId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('joke_entries').delete().eq('id', jokeId);
  if (error) return { error: error.message };
  return {};
}
