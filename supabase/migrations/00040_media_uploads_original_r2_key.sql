-- 00040_media_uploads_original_r2_key.sql
-- Salva l'originale (NON watermarked) su R2 con prefisso originals/ per
-- consentire re-watermark futuri senza sovrapporre al watermark precedente
-- (bug 29/07/2026 segnalato dall'utente: "le foto vecchie hanno watermark
-- sovrapposto al nuovo perché repairWatermark parte dall'immagine già
-- watermarked").
--
-- originals/<eventId>/<r2_key> contiene l'upload originale.
-- <eventId>/<r2_key> contiene la versione watermarked (cosa mostra la galleria).
--
-- Per le foto esistenti (pre-migration) la colonna sarà NULL → fallback su
-- r2_key per repairWatermark (perderà qualità su re-processing, ma non crasha).

ALTER TABLE media_uploads
  ADD COLUMN IF NOT EXISTS original_r2_key TEXT;

COMMENT ON COLUMN media_uploads.original_r2_key IS
  'Path R2 dell''originale NON watermarked (prefisso originals/). NULL per i record
   pre-migration 00040 — in quel caso repairWatermark parte dal watermarked corrente
   come fallback degradato. Popolato da processQueueForEvent quando l''originale
   viene persistito su R2 prima di applicare il watermark.';

-- Per le foto già processate, NULL è OK: il fallback userà r2_key (degradato
-- ma accettabile). Le NUOVE upload avranno original_r2_key valorizzato e
-- re-watermark futuri saranno puliti.
