/**
 * Tassonomia di classificazione errori del flusso di processing media.
 * RIFONDAZIONE 14/08/2026: prima ogni throw finiva appiattito a `other` nel
 * catch esterno di processQueueForEvent, rendendo la dashboard /admin/system
 * inutile per la diagnosi. Queste costanti + `classifyError` danno un mapping
 * stabile errore → classe, condiviso tra `system_health_log.failure_class`,
 * `upload_queue_dead_letter.last_failure_class` e `upload_queue.failure_class`.
 */

export const FAILURE_CLASS_R2_DOWNLOAD = 'r2_download_failed' as const;
export const FAILURE_CLASS_WATERMARK = 'watermark_apply_failed' as const;
export const FAILURE_CLASS_DRIVE = 'drive_sync_failed' as const;
export const FAILURE_CLASS_DETECT = 'detect_watermark_missing' as const;
export const FAILURE_CLASS_INVALID = 'invalid_image' as const;
export const FAILURE_CLASS_DB = 'db_write_failed' as const;
export const FAILURE_CLASS_OTHER = 'other' as const;

export type FailureClass =
  | typeof FAILURE_CLASS_R2_DOWNLOAD
  | typeof FAILURE_CLASS_WATERMARK
  | typeof FAILURE_CLASS_DRIVE
  | typeof FAILURE_CLASS_DETECT
  | typeof FAILURE_CLASS_INVALID
  | typeof FAILURE_CLASS_DB
  | typeof FAILURE_CLASS_OTHER;

/**
 * Classifica un errore (Error | string | unknown) nella tassonomia sopra.
 * Euristica basata sul testo del messaggio: copre i messaggi prodotti dai
 * vari path del flusso (R2 presigned/download, watermark sharp, Drive API,
 * DB upsert). Mantiene il comportamento precedente come fallback `other`.
 *
 * IMPORTANTE: esportata come funzione pura per testabilità — nessuna
 * dipendenza da Supabase/canale esterno.
 */
export function classifyError(err: unknown): FailureClass {
  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (/presigned|download r2|r2|non trovato|not found|no (presigned )?url|httperror/i.test(msg)) {
    return FAILURE_CLASS_R2_DOWNLOAD;
  }
  // NOTA: detect/verif della watermark va PRIMA del generico "watermark",
  // altrimenti "watermark ancora assente" verrebbe scambiato per errore di
  // applicazione (watermark_apply_failed) invece che di rilevamento.
  if (/detect|verif.*watermark|watermark.*(assent|mancant|missing)/i.test(msg)) {
    return FAILURE_CLASS_DETECT;
  }
  if (/watermark|sharp|overlay|ffmpeg|composite/i.test(msg)) {
    return FAILURE_CLASS_WATERMARK;
  }
  if (/drive|googleapi|oauth|token.*(revok|expir)|401|403/i.test(msg)) {
    return FAILURE_CLASS_DRIVE;
  }
  if (/invalid_image|mime|corrupt|unsupported|decode/i.test(msg)) {
    return FAILURE_CLASS_INVALID;
  }
  if (/insert|update|unique|constraint|violat|duplicate .*key|relation .* does not exist|duplicate key/i.test(msg)) {
    return FAILURE_CLASS_DB;
  }
  return FAILURE_CLASS_OTHER;
}