-- Admin/Manager schema: aggiunge supporto per utenti terzi (wedding planner, fotografi)

ALTER TABLE core_users DROP CONSTRAINT IF EXISTS core_users_role_check;
ALTER TABLE core_users ADD CONSTRAINT core_users_role_check
  CHECK (role IN ('sposo', 'organizzatore', 'invitato', 'manager', 'admin'));

ALTER TABLE core_auth_tokens DROP CONSTRAINT IF EXISTS core_auth_tokens_role_check;
ALTER TABLE core_auth_tokens ADD CONSTRAINT core_auth_tokens_role_check
  CHECK (role IN ('sposo', 'organizzatore', 'invitato', 'manager'));

CREATE TABLE IF NOT EXISTS event_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES core_users(id),
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE event_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read assigned events" ON events
  FOR SELECT USING (
    id IN (SELECT event_id FROM event_managers WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );
