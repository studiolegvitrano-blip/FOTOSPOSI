/**
 * Costanti e utility CLIENT-SAFE della Capsula del Tempo: ZERO import di moduli
 * node/sharp. Questo modulo e' l'unico che il bundle client deve raggiungere —
 * watermark.ts (funzioni server-only con sharp/ffmpeg) NON deve essere importato
 * da componenti client, altrimenti il build webpack fallisce con
 * "Can't resolve 'child_process'" (detect-libc/sharp nel bundle client).
 */

/** Frase fissa nel watermark delle capsule — DA DECIDERE (placeholder). */
export const FRASE_NOSTRA_WATERMARK = 'Sposi.live · Capsula del Tempo';

/** Video messaggio: max 3 minuti. */
export const CAPSULE_MAX_VIDEO_SECONDS = 180;

/** Frase utente nel watermark: max caratteri (la size si adatta da sola nel renderer). */
export const CAPSULE_MAX_PHRASE_CHARS = 60;

/**
 * Testo della striscia watermark capsula: frase utente + frase nostra.
 * Il renderer (video-overlay) scala la size per rientrare nei limiti.
 */
export function buildCapsuleWatermarkText(userPhrase?: string | null): string {
  const phrase = (userPhrase || '').trim();
  if (!phrase) return FRASE_NOSTRA_WATERMARK;
  return `${phrase} · ${FRASE_NOSTRA_WATERMARK}`;
}
