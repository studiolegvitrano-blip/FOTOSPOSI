-- Campi aggiuntivi per il form pubblico /collaboratori:
-- address (indirizzo, per tutti i tipi account) + vat_number (Partita IVA, per aziende/commerciali)

ALTER TABLE marketplace_suppliers
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS vat_number TEXT;

COMMENT ON COLUMN marketplace_suppliers.address IS
  'Indirizzo (via e civico) del fornitore, separato da city/region/country.';
COMMENT ON COLUMN marketplace_suppliers.vat_number IS
  'Partita IVA, compilata solo per account commerciale (azienda / Partita IVA).';
