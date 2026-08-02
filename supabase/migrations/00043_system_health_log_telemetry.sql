-- 00043_system_health_log_telemetry.sql
-- FIX 02/08/2026 — la telemetry di FIX 7 (logFailure + dlq-retry) non ha MAI
-- funzionato in produzione: il codice scrive colonne che non esistono
-- (kind, event_id, file_name, failure_class, error_message, retry_count) e
-- valori di `job` vietati dal CHECK originario ('backup','maintenance').
-- Risultato: ogni insert falliva silenziosamente (best-effort con console.warn),
-- quindi system_health_log conteneva solo le righe di cron backup/maintenance.
--
-- Fix:
--   1. Rilassa il CHECK su job per includere 'dlq-retry' e 'upload_processing_failure'.
--   2. Aggiunge le colonne telemetry usate da logFailure.
--   3. Indici per aggregazioni dashboard (failure_class, event_id, kind).

ALTER TABLE system_health_log DROP CONSTRAINT IF EXISTS system_health_log_job_check;
ALTER TABLE system_health_log
  ADD CONSTRAINT system_health_log_job_check
  CHECK (job IN ('backup', 'maintenance', 'dlq-retry', 'upload_processing_failure'));

ALTER TABLE system_health_log ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE system_health_log ADD COLUMN IF NOT EXISTS event_id UUID;
ALTER TABLE system_health_log ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE system_health_log ADD COLUMN IF NOT EXISTS failure_class TEXT;
ALTER TABLE system_health_log ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE system_health_log ADD COLUMN IF NOT EXISTS retry_count INT;

CREATE INDEX IF NOT EXISTS idx_system_health_log_kind_created ON system_health_log (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_log_event_id ON system_health_log (event_id);
CREATE INDEX IF NOT EXISTS idx_system_health_log_failure_class ON system_health_log (failure_class);

COMMENT ON COLUMN system_health_log.kind IS
  'Sottocategoria del job (es. upload_processing_failure). Per il job upload_processing_failure identifica la telemetry di process-queue.';
COMMENT ON COLUMN system_health_log.event_id IS
  'Evento coinvolto (per failure di processing upload). NULL per job globali (backup/maintenance).';
COMMENT ON COLUMN system_health_log.file_name IS
  'File che ha fallito (per upload_processing_failure). NULL per job globali.';
COMMENT ON COLUMN system_health_log.failure_class IS
  'Classe di errore (r2_download_failed, watermark_apply_failed, drive_sync_failed, detect_watermark_missing, invalid_image, other).';
COMMENT ON COLUMN system_health_log.error_message IS
  'Messaggio di errore leggibile (best-effort, puo\' contenere PII del file name).';
COMMENT ON COLUMN system_health_log.retry_count IS
  'Numero di retry tentati prima del fallimento (per upload_processing_failure).';
