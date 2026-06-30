-- Core schema: users, roles, tenants, auth tokens

CREATE TABLE core_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL CHECK (brand IN ('fotosposi', 'weddingmoments')),
  locale TEXT NOT NULL DEFAULT 'it',
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE core_tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE core_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sposo', 'organizzatore', 'invitato', 'admin')),
  tenant_id UUID NOT NULL REFERENCES core_tenants(id),
  event_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE core_users ENABLE ROW LEVEL SECURITY;

CREATE TABLE core_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('sposo', 'organizzatore', 'invitato')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE core_auth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can read own data" ON core_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can read tokens for their event" ON core_auth_tokens
  FOR SELECT USING (event_id IN (
    SELECT event_id FROM core_users WHERE id = auth.uid()
  ));
