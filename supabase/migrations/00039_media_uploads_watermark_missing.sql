ALTER TABLE media_uploads
  ADD COLUMN IF NOT EXISTS watermark_missing BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN media_uploads.watermark_missing IS
  'True quando process-queue ha caricato il file su R2 ma detectWatermark ha verificato che il watermark NON è effettivamente presente (self-healing check, sessione 28/07/2026). Foto resta visibile in galleria ma lo stato segnala il problema per retry/alerting.';

-- Importante: PostgREST tiene uno schema cache in memoria e NON si refresh
-- automaticamente dopo ALTER TABLE. Senza questo NOTIFY la nuova colonna è
-- invisibile al Data API (Supabase client incluso) e upsert/insert falliscono
-- con `42703 column "watermark_missing" does not exist in the schema cache`.
-- Vedi AGENTS.md sezione "Migrazioni DB".
NOTIFY pgrst, 'reload schema';
