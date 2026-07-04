-- Tabella ospiti registrati all'evento
CREATE TABLE IF NOT EXISTS event_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES core_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'denied')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE event_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event creators can read guests" ON event_guests
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE created_by = auth.uid())
  );

CREATE POLICY "Event creators can update guests" ON event_guests
  FOR UPDATE USING (
    event_id IN (SELECT id FROM events WHERE created_by = auth.uid())
  );

CREATE POLICY "Users can read their own guest record" ON event_guests
  FOR SELECT USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_event_guests_event_id ON event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_status ON event_guests(status);

-- Colonna modalita approvazione ospiti sull'evento
ALTER TABLE events ADD COLUMN IF NOT EXISTS guest_approval_mode TEXT NOT NULL DEFAULT 'auto' CHECK (guest_approval_mode IN ('auto', 'manual'));
