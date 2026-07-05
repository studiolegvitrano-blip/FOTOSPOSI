-- Un invitato che carica foto/video passa da upload_queue: INSERT era già permesso a chiunque,
-- ma UPDATE (usato per scrivere r2_key/status dopo il caricamento su R2, vedi
-- packages/media/src/queue.ts -> updateQueueItem) era permesso solo al creatore dell'evento.
-- Risultato: la foto dell'ospite restava incollata su "pending" per sempre (mai processata in
-- media_uploads) perché la UPDATE finale falliva silenziosamente sotto RLS.
DROP POLICY IF EXISTS "update_upload_queue" ON upload_queue;
CREATE POLICY "update_upload_queue" ON upload_queue
  FOR UPDATE USING (
    event_id IN (SELECT id FROM events WHERE created_by = auth.uid())
    OR uploaded_by = auth.uid()
  );
