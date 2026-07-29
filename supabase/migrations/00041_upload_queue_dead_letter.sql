-- 00041_upload_queue_dead_letter.sql
-- FIX 30/07/2026 — DLQ (Dead Letter Queue) per upload_queue.
--
-- Razionale: dopo N retry falliti (max 7), l'item viene spostato in questa
-- tabella invece di essere lasciato in upload_queue con status='failed'. Un
-- cron separato (/api/cron/dlq-retry, ogni 6h) riprova gli item della DLQ con
-- backoff esponenziale più lungo (1h→24h). Il sistema "assorbe" un singolo
-- invitato problematico senza bloccare gli altri item del suo evento o
-- di tutti gli altri eventi. Inoltre isola il fallimento dal processing
-- normale per analisi (admin dashboard, alerting).
--
-- Schema identico a upload_queue + colonne extra per la DLQ:
--   - moved_to_dlq_at: timestamp spostamento
--   - dlq_retry_count: numero tentativi di ri-processamento dalla DLQ
--   - last_failure_class: categoria errore (r2_download_failed, drive_sync_failed, ecc.)
--   - last_failure_message: messaggio errore leggibile
--   - original_upload_queue_id: FK soft all'item originale (per audit)

CREATE TABLE IF NOT EXISTS upload_queue_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Originale upload_queue row (copia completa, niente FK formale perché
  -- se rimuoviamo upload_queue in futuro la DLQ resta integra).
  original_upload_queue_id UUID NOT NULL,
  event_id UUID NOT NULL,
  uploaded_by UUID,
  file_name TEXT,
  file_type TEXT,
  file_size BIGINT,
  r2_key TEXT,
  drive_file_id TEXT,
  -- Stato processing
  retry_count INT NOT NULL DEFAULT 0,
  -- DLQ-specific
  moved_to_dlq_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  moved_to_dlq_reason TEXT,
  dlq_retry_count INT NOT NULL DEFAULT 0,
  dlq_next_retry_at TIMESTAMPTZ,
  last_failure_class TEXT,
  last_failure_message TEXT,
  -- Audit
  original_uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upload_queue_dead_letter_event_id_idx ON upload_queue_dead_letter (event_id);
CREATE INDEX IF NOT EXISTS upload_queue_dead_letter_dlq_retry_at_idx ON upload_queue_dead_letter (dlq_next_retry_at)
  WHERE dlq_next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS upload_queue_dead_letter_failure_class_idx ON upload_queue_dead_letter (last_failure_class);

COMMENT ON TABLE upload_queue_dead_letter IS
  'FIX 30/07/2026 — DLQ per item upload_queue che hanno esaurito i retry normali (max 7).
   Viene processata da /api/cron/dlq-retry con backoff esponenziale più lento.
   Permette al sistema di "assorbire" un singolo invitato problematico (es. foto
   corrotta, connessione ballerina persistente) senza bloccare gli altri item.';

-- RLS: solo service_role può leggere/scrivere (matching con upload_queue).
ALTER TABLE upload_queue_dead_letter ENABLE ROW LEVEL SECURITY;

-- Policy: service_role ha accesso completo (è il path normale del cron).
-- Nessuna policy per authenticated/anon: vietato accesso diretto dalla UI.
-- Le pagine admin future possono usare service_role client.
DROP POLICY IF EXISTS upload_queue_dead_letter_service_role_all ON upload_queue_dead_letter;
CREATE POLICY upload_queue_dead_letter_service_role_all ON upload_queue_dead_letter
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
