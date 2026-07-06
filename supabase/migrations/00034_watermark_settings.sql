-- Impostazioni watermark scelte dagli sposi:
-- - watermark_names: "Vuoi che nelle foto e nei video ci siano impressi i Vostri nomi?"
--   (true di default: comportamento attuale, nomi + data impressi)
-- - watermark_text: testo personalizzato scelto dagli sposi al posto di "nomi / data",
--   es. "Ciccia & Ciccio Sposi Palermo 06/07/2026" — libero, oppure uno dei suggerimenti
--   proposti dall'interfaccia. NULL = usa couple_name + date come prima.
-- Il logo Sposi.live resta sempre impresso a prescindere da questa scelta.
ALTER TABLE events ADD COLUMN IF NOT EXISTS watermark_names BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE events ADD COLUMN IF NOT EXISTS watermark_text TEXT;
