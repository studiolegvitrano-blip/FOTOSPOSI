-- 00057_partner_white_label.sql
-- 09/08/2026 — White label B2B: partner (ristoratori, fotografi, sale trattenimenti)
-- che regalano il servizio ai propri clienti.
--
-- Modello:
--   partners        → profilo B2B. Collegato a un account auth (user_id) al signup,
--                     e a affiliates (affiliate_id) se l'email matcha un collaboratore
--                     esistente → il partner accede con lo stesso account.
--   partner_codes   → licenze riscattabili acquistate in pacchetti (5/10/N).
--                     Ogni codice, riscattato da un cliente, crea un evento con
--                     partner_id impostato (white label attivo su quell'evento).
--   events.partner_id            → FK al partner che sponsorizza l'evento.
--   events.partner_claim_text    → testo "offerto da" (es. "Villa dei Fiori — Via Roma 1 — vlladeifiori.it")
--   affiliates.user_id           → link collaboratore → account auth (login con lo stesso account).

-- ---------------------------------------------------------------------------
-- 1) partners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES core_users(id) ON DELETE SET NULL,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  website TEXT,
  address TEXT,
  logo_url TEXT,
  claim_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partners_user_id_idx ON partners (user_id);
CREATE INDEX IF NOT EXISTS partners_affiliate_id_idx ON partners (affiliate_id);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Il partner vede/modifica solo il proprio profilo (user_id = auth.uid()).
DROP POLICY IF EXISTS partners_select_own ON partners;
CREATE POLICY partners_select_own ON partners
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS partners_update_own ON partners;
CREATE POLICY partners_update_own ON partners
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Inserimento via service_role (signup API) oppure authenticated con user_id proprio.
DROP POLICY IF EXISTS partners_insert_own ON partners;
CREATE POLICY partners_insert_own ON partners
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS partners_service_role_all ON partners;
CREATE POLICY partners_service_role_all ON partners
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE partners IS
  'White label B2B: profilo partner (ristoratore/fotografo/sala). user_id =
   account auth per il login, affiliate_id = link a collaboratori esistenti.';

-- ---------------------------------------------------------------------------
-- 2) partner_codes — licenze riscattabili
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  package_size INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'used', 'revoked')),
  redeemed_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  redeemed_by UUID REFERENCES core_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS partner_codes_partner_id_idx ON partner_codes (partner_id);
CREATE INDEX IF NOT EXISTS partner_codes_status_idx ON partner_codes (status);

ALTER TABLE partner_codes ENABLE ROW LEVEL SECURITY;

-- Il partner vede i propri codici.
DROP POLICY IF EXISTS partner_codes_select_own ON partner_codes;
CREATE POLICY partner_codes_select_own ON partner_codes
  FOR SELECT TO authenticated
  USING (partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid()));

-- Inserimento via service_role (acquisto pacchetti) o dall'utente partner.
DROP POLICY IF EXISTS partner_codes_insert_own ON partner_codes;
CREATE POLICY partner_codes_insert_own ON partner_codes
  FOR INSERT TO authenticated
  WITH CHECK (partner_id IN (SELECT id FROM partners WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS partner_codes_service_role_all ON partner_codes;
CREATE POLICY partner_codes_service_role_all ON partner_codes
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE partner_codes IS
  'Licenze riscattabili del white label. Ogni codice available viene usato da
   un cliente per creare un evento sponsorizzato (events.partner_id).';

-- ---------------------------------------------------------------------------
-- 3) events — colonne white label
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS partner_claim_text TEXT;

CREATE INDEX IF NOT EXISTS events_partner_id_idx ON events (partner_id)
  WHERE partner_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4) affiliates — link account auth
-- ---------------------------------------------------------------------------
ALTER TABLE affiliates
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES core_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS affiliates_user_id_idx ON affiliates (user_id)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) ruolo 'partner' in core_users (il portale B2B usa un account auth normale,
--    il profilo è in partners; il ruolo distingue la dashboard di destinazione).
-- ---------------------------------------------------------------------------
ALTER TABLE core_users DROP CONSTRAINT IF EXISTS core_users_role_check;
ALTER TABLE core_users ADD CONSTRAINT core_users_role_check
  CHECK (role IN ('sposo', 'organizzatore', 'invitato', 'manager', 'admin', 'partner'));

-- ---------------------------------------------------------------------------
-- Reload schema cache PostgREST (obbligatorio dopo ALTER TABLE).
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
