'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getCurrentUser } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Music, Search, Trash2, Download, FileText, Plus, Loader2, ExternalLink } from 'lucide-react';

interface TrackItem {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  art_url: string | null;
  duration_ms: number | null;
  preview_url: string | null;
  external_url: string;
}

interface SongItem {
  id: string;
  event_id: string;
  spotify_id: string;
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

function formatDuration(ms: number | null): string {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function MusicPlaylist({ eventId }: { eventId: string }) {
  const t = useTranslations('music');
  const c = useTranslations('common');
  const router = useRouter();

  const [songs, setSongs] = useState<SongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchError, setSearchError] = useState('');

  const loadSongs = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/songs`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || c('error_generic'));
        return;
      }
      setSongs(data.songs ?? []);
    } catch {
      setError(c('error_generic'));
    } finally {
      setLoading(false);
    }
  }, [eventId, c]);

  useEffect(() => {
    if (!eventId) return;
    loadSongs();
    getCurrentUser().then(({ user }) => {
      if (!user?.id) return;
      setCurrentUserId(user.id);
      setUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email || '');
    });
    fetch(`/api/events/${eventId}/details`)
      .then((r) => r.json())
      .then((d) => setCanManage(Boolean(d.canManage ?? d.isCreator)))
      .catch(() => setCanManage(false));
  }, [eventId, loadSongs]);

  const doSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || c('error_generic'));
        setResults([]);
        return;
      }
      setResults(data.tracks ?? []);
    } catch {
      setSearchError(c('error_generic'));
    } finally {
      setSearching(false);
    }
  };

  const addTrack = async (track: TrackItem) => {
    if (addingId) return;
    setAddingId(track.id);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track, added_by_name: userName || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || c('error_generic'));
        return;
      }
      setSongs((prev) => [...prev, data.song]);
      setResults((prev) => prev.filter((r) => r.id !== track.id));
    } catch {
      setError(c('error_generic'));
    } finally {
      setAddingId(null);
    }
  };

  const deleteTrack = async (song: SongItem) => {
    const allowed = canManage || (currentUserId && song.added_by_user_id === currentUserId);
    if (!allowed || deletingId) return;
    setDeletingId(song.id);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/songs/${song.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || c('error_generic'));
        return;
      }
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
    } catch {
      setError(c('error_generic'));
    } finally {
      setDeletingId(null);
    }
  };

  const canDelete = (song: SongItem) =>
    canManage || (currentUserId !== null && song.added_by_user_id === currentUserId);

  if (loading) return <p className="text-center mt-8">{c('loading')}</p>;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Music className="w-5 h-5 text-brand" />
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>
      <p className="text-text-muted text-sm">{t('subtitle')}</p>

      {error && <p className="text-red-600 text-sm bg-red-50 rounded p-2">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('search_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={doSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="flex-1"
            />
            <Button type="submit" disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {t('search_btn')}
            </Button>
          </form>
          {searchError && <p className="text-red-600 text-sm">{searchError}</p>}
          {results.length > 0 && (
            <ul className="divide-y">
              {results.map((track) => (
                <li key={track.id} className="py-2 flex items-center gap-3">
                  {track.art_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.art_url} alt={track.title} className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Music className="w-5 h-5 text-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{track.title}</p>
                    <p className="text-xs text-text-muted truncate">{track.artist} · {formatDuration(track.duration_ms)}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addTrack(track)}
                    disabled={addingId === track.id}
                  >
                    {addingId === track.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {t('add')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">
            {t('playlist_title')} ({songs.length})
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/events/${eventId}/songs/export?format=m3u`} download>
                <Download className="w-4 h-4" /> {t('export_m3u')}
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/events/${eventId}/songs/export?format=pdf`} download>
                <FileText className="w-4 h-4" /> {t('export_pdf')}
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {songs.length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">{t('empty')}</p>
          ) : (
            <ul className="divide-y">
              {songs.map((song) => (
                <li key={song.id} className="py-2 flex items-center gap-3">
                  {song.art_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={song.art_url} alt={song.title} className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Music className="w-5 h-5 text-text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{song.title}</p>
                    <p className="text-xs text-text-muted truncate">
                      {song.artist} · {formatDuration(song.duration_ms)}
                      {song.added_by_name ? ` · ${t('added_by', { name: song.added_by_name })}` : ''}
                    </p>
                  </div>
                  <a href={song.external_url} target="_blank" rel="noopener noreferrer" title={t('open_spotify')}>
                    <ExternalLink className="w-4 h-4 text-text-muted" />
                  </a>
                  {canDelete(song) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => deleteTrack(song)}
                      disabled={deletingId === song.id}
                    >
                      {deletingId === song.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
