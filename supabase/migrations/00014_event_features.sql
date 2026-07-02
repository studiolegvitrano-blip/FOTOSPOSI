CREATE TABLE IF NOT EXISTS event_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, feature_key)
);

ALTER TABLE event_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_features_select" ON event_features FOR SELECT USING (true);
CREATE POLICY "event_features_insert" ON event_features FOR INSERT WITH CHECK (true);
CREATE POLICY "event_features_update" ON event_features FOR UPDATE USING (true);
CREATE POLICY "event_features_delete" ON event_features FOR DELETE USING (true);
