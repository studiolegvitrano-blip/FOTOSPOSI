-- 00055 — Include 'rsvp-reminders' nel CHECK su system_health_log.job
--
-- Il cron /api/cron/rsvp-reminders scrive in system_health_log con job='rsvp-reminders',
-- ma il CHECK definito in 00043 accettava solo backup/maintenance/dlq-retry/upload_processing_failure.
-- Risultato: l'insert di telemetry falliva silenziosamente (il codice non verifica error)
-- e il cron rispondeva 200 senza mai loggare l'esecuzione.

ALTER TABLE system_health_log DROP CONSTRAINT IF EXISTS system_health_log_job_check;

ALTER TABLE system_health_log
  ADD CONSTRAINT system_health_log_job_check
  CHECK (job IN ('backup', 'maintenance', 'dlq-retry', 'upload_processing_failure', 'rsvp-reminders'));

NOTIFY pgrst, 'reload schema';
