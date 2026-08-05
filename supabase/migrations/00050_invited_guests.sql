-- Lista invitati manuale per solleciti RSVP.
-- Scelta utente (05/08/2026): tabella dedicata SEPARATA da event_guests
-- (event_guests è popolata automaticamente da QR/OAuth con user_id NOT NULL;
--  qui serve una lista manuale degli invitati: nome + email o WhatsApp,
--  livello di insistenza per sollecito, stato, contatori sollecito).
-- Il link evento + QR code + slogan brand vengono composti lato API/email.

CREATE TABLE IF NOT EXISTS invited_guests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  email            TEXT,
  whatsapp         TEXT,
  insist_level     TEXT NOT NULL DEFAULT 'medium'
                   CHECK (insist_level IN ('low','medium','high')),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','declined')),
  last_reminder_at TIMESTAMPTZ,
  reminder_count   INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invited_guests_event ON invited_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_invited_guests_status ON invited_guests(event_id, status);

ALTER TABLE invited_guests ENABLE ROW LEVEL SECURITY;

-- RLS: solo sposo (events.created_by). Le route usano service role (bypassa RLS).
-- NB: event_managers non esiste nel DB di produzione (migration 00006 mai applicata).

CREATE POLICY invited_guests_read ON invited_guests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = invited_guests.event_id AND e.created_by = auth.uid())
  );

CREATE POLICY invited_guests_insert ON invited_guests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM events e WHERE e.id = invited_guests.event_id AND e.created_by = auth.uid())
  );

CREATE POLICY invited_guests_update ON invited_guests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = invited_guests.event_id AND e.created_by = auth.uid())
  );

CREATE POLICY invited_guests_delete ON invited_guests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = invited_guests.event_id AND e.created_by = auth.uid())
  );

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rsvp_auto_reminder BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rsvp_reminder_days_before INT NOT NULL DEFAULT 7;

COMMENT ON TABLE invited_guests IS 'Lista invitati manuale per solleciti RSVP (feature 05/08/2026).';
COMMENT ON COLUMN invited_guests.insist_level IS 'low=1 max solleciti, medium=2, high=3.';
COMMENT ON COLUMN invited_guests.status IS 'pending/confirmed/declined.';
COMMENT ON COLUMN invited_guests.reminder_count IS 'Solleciti già inviati (reset quando status cambia).';
COMMENT ON COLUMN events.rsvp_auto_reminder IS 'Abilita cron notturno solleciti RSVP.';
COMMENT ON COLUMN events.rsvp_reminder_days_before IS 'Giorni prima della scadenza RSVP per inviare sollecito.';

NOTIFY pgrst, 'reload schema';