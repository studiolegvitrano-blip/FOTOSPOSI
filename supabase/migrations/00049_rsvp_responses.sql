-- RSVP avanzato: conferma presenza con capofamiglia + accompagnatori
-- (adulto/minore, età esatta per minori) e intolleranze alimentari multiple.
-- vedi PROJECT_STATUS sessione 05/08/2026 (feature "modulo RSVP")

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  host_name        TEXT NOT NULL,
  host_intolerances JSONB NOT NULL DEFAULT '[]',
  guests           JSONB NOT NULL DEFAULT '[]',
  message          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  brand            TEXT NOT NULL DEFAULT 'Sposi.live'
);

CREATE INDEX IF NOT EXISTS idx_rsvp_event_id ON rsvp_responses(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_event_created ON rsvp_responses(event_id, created_at DESC);

ALTER TABLE rsvp_responses ENABLE ROW LEVEL SECURITY;

-- SELECT: sposo (events.created_by) o manager (event_managers edit/admin)
CREATE POLICY rsvp_read ON rsvp_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = rsvp_responses.event_id
        AND (
          e.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM event_managers em
            WHERE em.event_id = e.id
              AND em.user_id = auth.uid()
              AND em.permission IN ('edit','admin')
          )
        )
    )
  );

-- INSERT: chiunque possa accedere all'evento (sposo + ospiti registrati).
-- Il form pubblico del sito-evento usa service role (anon key bloccata dalla
-- policy SELECT sposo-only): serve la policy INSERT per l'upsert autenticato.
CREATE POLICY rsvp_insert ON rsvp_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      LEFT JOIN event_guests eg ON eg.event_id = e.id
      WHERE e.id = rsvp_responses.event_id
        AND (
          e.created_by = auth.uid()
          OR eg.user_id = auth.uid()
        )
    )
  );

COMMENT ON TABLE rsvp_responses IS
  'Conferme presenza RSVP con accompagnatori (adulto/minore + età minori) e intolleranze alimentari multiple. feature 05/08/2026.';
COMMENT ON COLUMN rsvp_responses.host_name IS 'Nome e cognome del capofamiglia/invitato principale.';
COMMENT ON COLUMN rsvp_responses.host_intolerances IS 'Array JSON di intolleranze/allergie del capofamiglia (es. ["Glutine","Lattosio"]).';
COMMENT ON COLUMN rsvp_responses.guests IS 'Array JSON accompagnatori: [{ name, type: adult|minor, age: int|null, intolerances: string[] }].';
COMMENT ON COLUMN rsvp_responses.message IS 'Messaggio libero opzionale dell''invitato.';

NOTIFY pgrst, 'reload schema';
