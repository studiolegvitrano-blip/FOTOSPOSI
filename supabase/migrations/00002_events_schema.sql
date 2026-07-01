-- Events schema

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES core_tenants(id),
  created_by UUID NOT NULL REFERENCES core_users(id),
  couple_name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT NOT NULL,
  brand TEXT NOT NULL CHECK (brand IN ('fotosposi', 'weddingmoments')),
  tier TEXT NOT NULL CHECK (tier IN ('base', 'premium', 'destination')) DEFAULT 'base',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE TABLE sub_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('addio_celibato', 'matrimonio', 'brunch', 'cena_prova')),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sub_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE event_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_windows ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see events they belong to
CREATE POLICY "Users can read own event" ON events
  FOR SELECT USING (
    id IN (SELECT event_id FROM core_users WHERE id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create their own events" ON events
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can read sub_events of their event" ON sub_events
  FOR SELECT USING (
    event_id IN (SELECT event_id FROM core_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can read windows of their event" ON event_windows
  FOR SELECT USING (
    event_id IN (SELECT event_id FROM core_users WHERE id = auth.uid())
  );
