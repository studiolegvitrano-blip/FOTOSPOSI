-- 00058_orders_iban.sql — Pagamenti con bonifico (IBAN)
-- Modello: l'ordine nasce 'pending' con payment_method='iban' e una causale
-- univoca (payment_reference). L'admin conferma il bonifico ricevuto →
-- status 'paid' → eventuale side-effect (es. generazione codici partner)
-- eseguito dalla route di conferma, non qui (regola: niente side-effect in DDL).

-- 1) Colonna metodo di pagamento su orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'stripe'
    CHECK (payment_method IN ('stripe', 'iban'));

-- 1b) event_id nullable: gli ordini "pacchetto partner" non sono legati a un
--     matrimonio specifico (l'acquisto è personale del partner).
ALTER TABLE orders ALTER COLUMN event_id DROP NOT NULL;

-- 2) Causale univoca del bonifico (per matching con l'estratto conto)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- 3) Metadata liberi per ordini non-prodotto (es. pacchetto partner:
--    {"kind":"partner_package","tier":"premium","quantity":10})
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 4) Impostazioni di piattaforma (chiave-valore): coordinate bonifico.
--    Gestite da console admin (tabella leggibile solo via service role).
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Accesso: nessuna policy per anon/autenticati — solo service role.
-- (Le coordinate vengono esposte agli utenti SOLO via route API che le
--  legge server-side e le inietta nel checkout.)

-- Seed: coordinate placeholder. Da valorizzare via console admin o SQL:
--   UPDATE platform_settings SET value='IT00X...' WHERE key='iban';
INSERT INTO platform_settings (key, value) VALUES
  ('iban', 'IT00 0000 0000 0000 0000 0000 000'),
  ('iban_holder', 'Sposi.live srl'),
  ('iban_bank', 'IT')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
