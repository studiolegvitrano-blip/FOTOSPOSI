-- Aggiunge il unique constraint richiesto dall'upsert di createMediaRecord
-- (packages/media/src/service.ts:33: onConflict: 'event_id,r2_key').
-- Senza questo constraint, l'upsert fallisce con
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- e nessun file viene mai scritto in media_uploads: la galleria resta vuota anche
-- se l'upload su R2 è andato a buon fine.
--
-- Verificato 27/07/2026: 0 duplicati su 51 record esistenti con r2_key valorizzato,
-- quindi la creazione del constraint è sicura.

ALTER TABLE media_uploads
  ADD CONSTRAINT uniq_media_event_r2key UNIQUE (event_id, r2_key);
