ALTER TABLE media_uploads
  ADD COLUMN IF NOT EXISTS watermark_missing BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN media_uploads.watermark_missing IS
  'True quando process-queue ha caricato il file su R2 ma detectWatermark ha verificato che il watermark NON è effettivamente presente (self-healing check, sessione 28/07/2026). Foto resta visibile in galleria ma lo stato segnala il problema per retry/alerting.';
