/**
 * FIX 29/07/2026 — TeraboxProvider: STUB.
 *
 * Terabox (https://www.terabox.com/) offre 1TB gratis (cifratura lato server).
 * API: protocollo proprietario non documentato, libreria Python `terabox-upload`
 * disponibile ma inaffidabile per Node (richiede reverse-engineering del
 * protocollo pan.baidu.com da cui deriva).
 *
 * Per implementare realmente servono le env vars:
 *   - TERABOX_API_KEY
 *   - TERABOX_API_SECRET
 *   - TERABOX_COOKIE (opzionale, se usi session cookie invece di API key)
 *
 * Lo stub ritorna ProviderNotConfiguredError finché queste env non sono
 * configurate. process-queue.ts gestisce il fallback.
 *
 * Esempio di implementazione futura (NON testato, richiede reverse-engineering):
 *
 *   // Step 1: ottieni token di sessione via /api/user/login
 *   const loginRes = await fetch('https://www.terabox.com/api/user/login', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
 *     body: new URLSearchParams({
 *       client_id: process.env.TERABOX_API_KEY,
 *       client_secret: process.env.TERABOX_API_SECRET,
 *     }),
 *   });
 *   // Step 2: usa /api/upload per inviare il file (multipart)
 *   // Step 3: salva il fs_id ritornato come remoteFileId
 */

import { ProviderNotConfiguredError, type BackupProvider, type BackupUploadInput, type BackupUploadResult } from './providers';

export class TeraboxProvider implements BackupProvider {
  readonly id = 'terabox' as const;
  readonly displayName = 'Terabox';

  isConfigured(): boolean {
    return !!(process.env.TERABOX_API_KEY && process.env.TERABOX_API_SECRET);
  }

  async ensureFolders(_opts: { brand: string }): Promise<{ folders?: any; error?: string }> {
    const missing: string[] = [];
    if (!process.env.TERABOX_API_KEY) missing.push('TERABOX_API_KEY');
    if (!process.env.TERABOX_API_SECRET) missing.push('TERABOX_API_SECRET');
    return { error: new ProviderNotConfiguredError('terabox', missing).message };
  }

  async uploadFile(_input: BackupUploadInput, _token: { accessToken: string }): Promise<BackupUploadResult> {
    const missing: string[] = [];
    if (!process.env.TERABOX_API_KEY) missing.push('TERABOX_API_KEY');
    if (!process.env.TERABOX_API_SECRET) missing.push('TERABOX_API_SECRET');
    throw new ProviderNotConfiguredError('terabox', missing);
  }
}
