-- 00059_upload_queue_solidity.sql — Rifondazione "solidità" coda upload
-- RIFONDAZIONE 14/08/2026 (completata): chiude i gap P0 residui del flusso
-- upload → R2 → coda → watermark → galleria → Google Drive.
--
-- 1) CLAIM ATOMICO via RPC (FOR UPDATE SKIP LOCKED): elimina la race condition
--    per cui due worker concorrenti (cron maintenance + route process-queue
--    client, o due invocazioni lambda sovrapposte) processavano lo STESSO item
--    → doppio watermark, doppio upload R2, doppio record Drive.
-- 2) consecutive_refresh_failures su event_drive_tokens: il circuit breaker
--    OAuth marca `status='revoked'` solo dopo N fallimenti consecutivi (non dal
--    primo invalid_grant) — evita revoche premature per blip OAuth transitori.
-- 3) CHECK constraint sullo status di upload_queue: impedisce typos silenziosi
--    ('procesing') che lasciavano item invisibili a retry.
--
-- Nessun side-effect business qui (regola: niente side-effect in DDL): solo
-- schema + RPC. Il comportamento vive in apps/web/src/lib/process-queue.ts.

-- =====================================================================
-- 1) CLAIM ATOMICO: RPC che preleva il prossimo item processabile con
--    lock atomico FOR UPDATE SKIP LOCKED.
--
--    Perché una RPC e non un semplice `UPDATE ... RETURNING`?
--      - `UPDATE ... WHERE status IN (...) AND ... RETURNING` con SKIP LOCKED
--        non è esprimibile in PostgREST direttamente (bisognerebbe passare per
--        una query che fa SELECT ... FOR UPDATE SKIP LOCKED in una transazione).
--      - Una funzione `SECURITY DEFINER` incapsula la transazione e accede con
--        i diritti del proprietario, bypassando RLS in modo controllato.
--
--    Firma: claim_next_upload_queue_item(event_id, limit) → setof upload_queue
--    Ritorna gli item "claimati" (status impostato a 'processing'). Il chiamante
--    (service_role) li riceve già marcati 'processing' → nessun altro worker
--    può ripescârli perché il filtro status IN ('pending','failed') li esclude.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.claim_upload_queue_items(
  p_event_id UUID,
  p_limit INT DEFAULT 5
) RETURNS SETOF public.upload_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := now();
  claimed_ids UUID[];
  r public.upload_queue%ROWTYPE;
BEGIN
  -- SELECT ... FOR UPDATE SKIP LOCKED: lock esclusivo sulle righe candidate,
  -- salta quelle già bloccate da un'altra transazione concorrente.
  SELECT ARRAY(
    SELECT q.id
    FROM public.upload_queue q
    WHERE q.event_id = p_event_id
      AND q.status IN ('pending', 'failed')
      AND q.retry_count < 7
      AND q.permanent_failure = false
      AND (q.next_retry_at IS NULL OR q.next_retry_at <= now_ts)
    ORDER BY q.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ) INTO claimed_ids;

  IF claimed_ids IS NULL OR array_length(claimed_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Marca gli item claimati come 'processing' e li restituisce al chiamante.
  RETURN QUERY
    UPDATE public.upload_queue
    SET status = 'processing', updated_at = now_ts
    WHERE id = ANY(claimed_ids)
    RETURNING public.upload_queue.*;
END;
$$;

COMMENT ON FUNCTION public.claim_upload_queue_items(UUID, INT) IS
  'RIFONDAZIONE 14/08/2026 — claim atomico con FOR UPDATE SKIP LOCKED.
   Preleva fino a p_limit item processabili (pending/failed, retry<7, non
   permanent_failure, backoff scaduto) per un evento e li marca processing in
   UN\'unica transazione. Elimina la race condition del pattern precedente
   (select + update a due passi non atomici). Chiamata solo da service_role
   (process-queue.ts).';

-- RLS: la funzione è SECURITY DEFINER e gira coi diritti del proprietario,
-- quindi bypassa RLS. Nessuna policy aggiuntiva necessaria. MA per sicurezza
-- revochiamo l'EXECUTE a PUBLIC così solo service_role (o ruoli espliciti)
-- può invocarla: impedisce a un client anon/authenticated di claimare item
-- di altri eventi.
REVOKE ALL ON FUNCTION public.claim_upload_queue_items(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_upload_queue_items(UUID, INT) TO service_role;

-- =====================================================================
-- 2) CIRCUIT BREAKER OAuth: contatore fallimenti consecutivi.
--    `refreshDriveTokenIfExpired` (process-queue.ts) incrementa questo
--    contatore a ogni refresh fallito e lo resetta a 0 su successo. Solo
--    quando raggiunge una soglia (3) marca status='revoked'.
-- =====================================================================
ALTER TABLE event_drive_tokens
  ADD COLUMN IF NOT EXISTS consecutive_refresh_failures INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN event_drive_tokens.consecutive_refresh_failures IS
  'RIFONDAZIONE 14/08/2026 — contatore refresh OAuth falliti consecutivi.
   Incrementato da refreshDriveTokenIfExpired a ogni refresh fallito, azzerato su
   successo. Il circuit breaker marca status=revoked SOLO quando >= 3 (soglia),
   per non revocare token vivi su un singolo blip OAuth (es. invalid_grant
   temporaneo da rate-limit Google o 500 transitorio).';

-- =====================================================================
-- 3) CHECK constraint sullo status di upload_queue.
--    Lo status è TEXT libero oggi; un typo ('procesing') lasciava l\'item
--    invisibile al recovery (filtro status='processing') e al retry.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'upload_queue_status_check'
      AND conrelid = 'public.upload_queue'::regclass
  ) THEN
    ALTER TABLE public.upload_queue
      ADD CONSTRAINT upload_queue_status_check
      CHECK (status IN ('pending', 'processing', 'synced', 'failed'));
  END IF;
END $$;

-- =====================================================================
-- REFRESH POSTGREST CACHE
-- =====================================================================
NOTIFY pgrst, 'reload schema';