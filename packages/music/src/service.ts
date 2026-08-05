// CRUD su tabella event_songs (playlist matrimonio condivisa)
// vedi migration 00047 — feature "colonna sonora condivisa" 04/08/2026
// Provider di ricerca: iTunes Search API (05/08/2026 — Spotify richiede Premium).

import { createServiceClient } from '@fotosposi/core';
import type { TrackItem } from './itunes';

export interface EventSong {
  id: string;
  event_id: string;
  track_id: string;
  title: string;
  artist: string;
  album: string | null;
  art_url: string | null;
  duration_ms: number | null;
  preview_url: string | null;
  external_url: string;
  added_by_user_id: string | null;
  added_by_name: string | null;
  added_at: string;
  brand: string;
}

export interface AddSongParams {
  event_id: string;
  track: TrackItem;
  added_by_user_id?: string | null;
  added_by_name?: string | null;
  brand?: string;
}

export interface SongListResult {
  songs: EventSong[];
  total: number;
}

/**
 * Helper: artisti → string "Artist1, Artist2".
 */
export function formatArtists(track: TrackItem): string {
  return track.artists.map((a) => a.name).join(', ');
}

/**
 * Aggiunge un brano alla playlist matrimonio. Non deduplica (multipli OK).
 */
export async function addSong(
  params: AddSongParams,
): Promise<{ id: string } | { error: string }> {
  const supabase = createServiceClient();

  const {
    event_id,
    track,
    added_by_user_id = null,
    added_by_name = null,
    brand = 'Sposi.live',
  } = params;

  if (!event_id) return { error: 'event_id mancante' };
  if (!track || !track.id || !track.external_url) {
    return { error: 'track non valida' };
  }

  const insert = {
    event_id,
    track_id: track.id,
    title: track.name,
    artist: formatArtists(track),
    album: track.album?.name ?? null,
    art_url: track.art_url ?? null,
    duration_ms: track.duration_ms ?? null,
    preview_url: track.preview_url ?? null,
    external_url: track.external_url,
    added_by_user_id,
    added_by_name,
    brand,
  };

  const { data, error } = await supabase
    .from('event_songs')
    .insert(insert)
    .select('id')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'errore insert event_songs' };
  }
  return { id: data.id as string };
}

/**
 * Lista brani playlist matrimonio (ordinati per added_at DESC).
 */
export async function listSongs(eventId: string): Promise<SongListResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_songs')
    .select('*')
    .eq('event_id', eventId)
    .order('added_at', { ascending: false });

  if (error) return { songs: [], total: 0 };
  return { songs: (data ?? []) as unknown as EventSong[], total: data?.length ?? 0 };
}

export async function getSongById(
  songId: string,
): Promise<EventSong | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_songs')
    .select('*')
    .eq('id', songId)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as EventSong;
}

/**
 * Cancella un brano dalla playlist.
 * Permessi gestiti da RLS (added_by_user_id = auth.uid() OR events.created_by).
 */
export async function deleteSong(songId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('event_songs').delete().eq('id', songId);
  return !error;
}
