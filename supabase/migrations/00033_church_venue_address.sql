-- Prima "nome" e "indirizzo" di Cerimonia/Ricevimento erano un unico campo testo libero
-- (es. "Chiesa San Pietro, Via Roma 10"), che rendeva il link Google Maps meno affidabile e
-- mischiava due informazioni diverse in un solo campo. Separati in nome + indirizzo dedicato.
ALTER TABLE events ADD COLUMN IF NOT EXISTS church_address TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS venue_address TEXT;
