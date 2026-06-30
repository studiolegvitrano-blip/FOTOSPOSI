CREATE TABLE IF NOT EXISTS event_drive_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  drive_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_drive_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event creators can manage their drive tokens" ON event_drive_tokens
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE created_by = auth.uid())
  );

CREATE POLICY "Service role can manage all drive tokens" ON event_drive_tokens
  FOR ALL USING (auth.role() = 'service_role');
