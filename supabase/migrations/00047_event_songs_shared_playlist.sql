-- Tabella playlist matrimonio: brani proposti da sposi + invitati via Spotify
-- vedi PROJECT_STATUS sessione 04/08/2026 (feature "colonna sonora condivisa")

CREATE TABLE IF NOT EXISTS event_songs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  spotify_id      TEXT NOT NULL,
  title           TEXT NOT NULL,
  artist          TEXT NOT NULL,
  album           TEXT,
  art_url         TEXT,
  duration_ms     INT,
  preview_url     TEXT,
  external_url    TEXT NOT NULL,
  added_by_user_id UUID REFERENCES core_users(id) ON DELETE SET NULL,
  added_by_name   TEXT,
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  brand           TEXT NOT NULL DEFAULT 'Sposi.live'
);

CREATE INDEX IF NOT EXISTS idx_event_songs_event_id ON event_songs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_songs_event_added ON event_songs(event_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_songs_spotify_event ON event_songs(spotify_id, event_id);

ALTER TABLE event_songs ENABLE ROW LEVEL SECURITY;

-- SELECT: sposo (events.created_by) o ospite registrato (event_guests)
CREATE POLICY songs_event_read ON event_songs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      LEFT JOIN event_guests eg ON eg.event_id = e.id
      WHERE e.id = event_songs.event_id
        AND (
          e.created_by = auth.uid()
          OR eg.user_id = auth.uid()
        )
    )
  );

-- INSERT: sposo o ospite registrato
CREATE POLICY songs_event_insert ON event_songs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      LEFT JOIN event_guests eg ON eg.event_id = e.id
      WHERE e.id = event_songs.event_id
        AND (
          e.created_by = auth.uid()
          OR eg.user_id = auth.uid()
        )
    )
  );

-- DELETE: chi ha inserito il brano OPPURE il creatore dell'evento (sposo)
CREATE POLICY songs_event_delete ON event_songs
  FOR DELETE USING (
    added_by_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_songs.event_id
        AND e.created_by = auth.uid()
    )
  );

COMMENT ON TABLE event_songs IS
  'Playlist matrimonio: brani Spotify proposti da sposi + invitati. vedi feature "colonna sonora condivisa" 04/08/2026.';
COMMENT ON COLUMN event_songs.spotify_id IS 'Spotify track ID (base62).';
COMMENT ON COLUMN event_songs.added_by_user_id IS 'core_users.id di chi ha proposto il brano (NULL se inserito via QR anonimo service role).';
COMMENT ON COLUMN event_songs.added_by_name IS 'Nome display di chi ha proposto (first+last o email o nickname guest).';
COMMENT ON COLUMN event_songs.brand IS 'Brand al momento dell''inserimento (Sposi.live o JustMarry.live) per routing UI/i18n EXPORT.';

NOTIFY pgrst, 'reload schema';
