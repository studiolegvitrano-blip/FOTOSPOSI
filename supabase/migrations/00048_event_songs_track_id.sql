-- Rinominazione spotify_id -> track_id: il provider di ricerca brani è ora
-- iTunes Search API (05/08/2026) — Spotify Web API richiede Premium, bloccato.
-- vedi PROJECT_STATUS sessione 05/08/2026

ALTER TABLE event_songs RENAME COLUMN spotify_id TO track_id;
DROP INDEX IF EXISTS idx_event_songs_spotify_event;
CREATE INDEX IF NOT EXISTS idx_event_songs_track_event ON event_songs(track_id, event_id);

COMMENT ON COLUMN event_songs.track_id IS 'ID del brano nel provider di ricerca (iTunes trackId).';

COMMENT ON TABLE event_songs IS
  'Playlist matrimonio: brani proposti da sposi + invitati. Ricerca via iTunes Search API (05/08/2026).';

NOTIFY pgrst, 'reload schema';
