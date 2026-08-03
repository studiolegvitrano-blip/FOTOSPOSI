-- Nuove colonne per il form pubblico /collaboratori (submission partner)
-- vedi PROJECT_STATUS sessione 03/08/2026

ALTER TABLE marketplace_suppliers
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'privato'
    CHECK (account_type IN ('commerciale','privato')),
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'IT',
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS years_experience INT,
  ADD COLUMN IF NOT EXISTS pricing_from NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS agreed_terms BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS submission_source TEXT NOT NULL DEFAULT 'public_form';

COMMENT ON COLUMN marketplace_suppliers.account_type IS
  'Tipo di account del submitter: commerciale (azienda/Partita IVA) o privato (freelance).';
COMMENT ON COLUMN marketplace_suppliers.full_name IS
  'Nome e cognome del contatto (se diverso dal `name` che e'' il brand pubblicato).';
COMMENT ON COLUMN marketplace_suppliers.business_name IS
  'Nome azienda/brand distinto da `name` (usato per mantenere name come display name coerente legacy).';
COMMENT ON COLUMN marketplace_suppliers.submitted_at IS
  'Timestamp di submission del form pubblico (priority su created_at perambio flusso candidature).';
COMMENT ON COLUMN marketplace_suppliers.submission_source IS
  'Origine della candidatura: public_form, admin_import, partner_invite.';
