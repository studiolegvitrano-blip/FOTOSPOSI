-- 00060_upload_queue_backoff_columns.sql — Colonne backoff/circuit breaker
-- RIFONDAZIONE 14/08/2026 (documentazione).
--
-- CONTESTO: le colonne `next_retry_at`, `failure_class` e `permanent_failure`
-- su upload_queue erano già state aggiunte al DB remoto (rifondazione 14/08
-- parziale) MA SENZA una migration tracciata nel repo → drift repo↔remote.
-- Questa migration è IDEMPOTENTE e allinea ciò che il codice già usa
-- (processQueueForEvent filtra `.eq('permanent_failure', false)` e
--  `.or('next_retry_at.is.null,next_retry_at.lte.now')`) con ciò che il repo
-- dichiara, così un eventuale reset/ripristino non perde le colonne.

-- 1) next_retry_at: backoff esponenziale reale (computeProcessingBackoffMs).
--    NULL = pronto subito (item pending o mai fallito).
ALTER TABLE upload_queue
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

COMMENT ON COLUMN upload_queue.next_retry_at IS
  'RIFONDAZIONE 14/08/2026 — timestamp del prossimo tentativo consentito
   (backoff esponenziale computeProcessingBackoffMs). NULL = pronto subito.
   Il cron skippa gli item con next_retry_at nel futuro (filtro .or in
   processQueueForEvent).';

-- 2) failure_class: classe dell\'ultimo fallimento (stessa tassonomia di
--    system_health_log.failure_class). Popolata dal path di fallimento.
ALTER TABLE upload_queue
  ADD COLUMN IF NOT EXISTS failure_class TEXT;

COMMENT ON COLUMN upload_queue.failure_class IS
  'RIFONDAZIONE 14/08/2026 — classe dell\'ultimo fallimento (r2_download_failed,
   drive_sync_failed, watermark_apply_failed, detect_watermark_missing,
   invalid_image, other). Aiuta l\'audit per-item senza dover incrociare
   system_health_log.';

-- 3) permanent_failure: flag che blocca il retry finché un admin non interviene.
ALTER TABLE upload_queue
  ADD COLUMN IF NOT EXISTS permanent_failure BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN upload_queue.permanent_failure IS
  'RIFONDAZIONE 14/08/2026 — quando true, il cron NON ritenta più l\'item
   (filtro .eq permanent_failure=false in processQueueForEvent). Serve per
   errori strutturali (token revocato, file orfano) che si ripresenterebbero
   identici a ogni tentativo. Reset manuale da admin quando la causa è risolta.';

-- Indice per il backoff sweep (next_retry_at usato nel filtro .or).
CREATE INDEX IF NOT EXISTS idx_upload_queue_next_retry_at ON upload_queue (next_retry_at)
  WHERE next_retry_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';