ALTER TABLE events ADD COLUMN IF NOT EXISTS hashtag TEXT;

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'other')),
  post_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  author_name TEXT,
  author_avatar TEXT,
  embed_html TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_posts_select" ON social_posts FOR SELECT USING (true);
CREATE POLICY "social_posts_insert" ON social_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM events WHERE id = event_id)
);

CREATE INDEX IF NOT EXISTS idx_social_posts_event ON social_posts(event_id);
