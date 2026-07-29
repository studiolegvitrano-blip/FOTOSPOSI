/**
 * FIX 29/07/2026 — MegaProvider: STUB.
 *
 * MEGA.nz fornisce 20GB gratis + storage cifrato lato client. API:
 *   - Endpoint: https://g.api.mega.co.nz/
 *   - Auth: login email/password (ottiene session token + chiavi RSA)
 *   - Upload: chunked + cifrato AES-CBC prima di uploadare
 *   - Libreria consigliata per Node: `megajs` (https://github.com/qgustavor/megajs)
 *
 * Per implementare realmente servono le env vars:
 *   - MEGA_EMAIL
 *   - MEGA_PASSWORD
 *   - MEGA_API_KEY (opzionale, per uso API key-based invece di password)
 *
 * Lo stub ritorna ProviderNotConfiguredError finché queste env non sono
 * configurate. process-queue.ts gestisce il fallback (la foto resta su R2,
 * badge "Backup temporaneo" appare in galleria).
 *
 * Esempio di implementazione futura (da rimuovere questo stub):
 *
 *   import { Storage } from 'megajs';
 *
 *   const storage = new Storage({
 *     email: process.env.MEGA_EMAIL,
 *     password: process.env.MEGA_PASSWORD,
 *   });
 *   await storage.ready;
 *   const root = storage.root;
 *   let brandFolder = root.children?.find(c => c.name === brand);
 *   if (!brandFolder) brandFolder = await storage.mkdir(brand);
 *   const file = await brandFolder.upload({ name: filename, size: buffer.length }, buffer);
 *   return { remoteFileId: file.nodeId };
 */

import { ProviderNotConfiguredError, type BackupProvider, type BackupUploadInput, type BackupUploadResult } from './providers';

export class MegaProvider implements BackupProvider {
  readonly id = 'mega' as const;
  readonly displayName = 'MEGA.nz';

  isConfigured(): boolean {
    return !!(process.env.MEGA_EMAIL && process.env.MEGA_PASSWORD);
  }

  async ensureFolders(_opts: { brand: string }): Promise<{ folders?: any; error?: string }> {
    const missing: string[] = [];
    if (!process.env.MEGA_EMAIL) missing.push('MEGA_EMAIL');
    if (!process.env.MEGA_PASSWORD) missing.push('MEGA_PASSWORD');
    return { error: new ProviderNotConfiguredError('mega', missing).message };
  }

  async uploadFile(_input: BackupUploadInput, _token: { accessToken: string }): Promise<BackupUploadResult> {
    const missing: string[] = [];
    if (!process.env.MEGA_EMAIL) missing.push('MEGA_EMAIL');
    if (!process.env.MEGA_PASSWORD) missing.push('MEGA_PASSWORD');
    throw new ProviderNotConfiguredError('mega', missing);
  }
}
