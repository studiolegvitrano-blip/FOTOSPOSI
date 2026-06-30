-- Games schema

CREATE TABLE game_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE game_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES game_categories(id),
  media_id UUID NOT NULL REFERENCES media_uploads(id),
  voter_id UUID NOT NULL REFERENCES core_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category_id, voter_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE TABLE joke_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  from_user UUID NOT NULL REFERENCES core_users(id),
  content TEXT NOT NULL,
  reveal_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE joke_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read games of their event" ON game_categories
  FOR SELECT USING (
    event_id IN (SELECT event_id FROM core_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can vote in their event" ON votes
  FOR INSERT WITH CHECK (
    event_id IN (SELECT event_id FROM core_users WHERE id = auth.uid())
  );
