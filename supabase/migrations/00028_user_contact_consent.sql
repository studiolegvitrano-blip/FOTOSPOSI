-- Nome/cognome separati, cellulare e consensi privacy per la registrazione sposi.
ALTER TABLE core_users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE core_users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE core_users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE core_users ADD COLUMN IF NOT EXISTS gdpr_consent_at TIMESTAMPTZ;
ALTER TABLE core_users ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN core_users.gdpr_consent_at IS 'Timestamp del consenso privacy/trattamento dati obbligatorio (GDPR EU o legge equivalente extra-UE).';
COMMENT ON COLUMN core_users.marketing_consent IS 'Consenso facoltativo alla condivisione dati con terze parti / marketing.';
