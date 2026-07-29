/**
 * FIX 29/07/2026 — GoogleDriveProvider: implementazione concreta dell'interfaccia
 * BackupProvider per Google Drive. Riusa la logica OAuth/Folder gi esistente in
 * `tokens.ts` (refresh, ensureFolders) e l'endpoint multipart upload di Drive API
 * v3.
 *
 * Per ora non viene ancora adoperato da `process-queue.ts` (vedi TODO post-fix).
 * Sar adoperato quando si vuole rendere il provider swappabile senza toccare la
 * pipeline — refactoring successivo dopo che MegaProvider/TeraboxProvider saranno
 * implementati davvero.
 */

import { ensureDriveFolders, type DriveFolderMap } from './tokens';
import type { BackupProvider, BackupUploadInput, BackupUploadResult } from './providers';

export class GoogleDriveProvider implements BackupProvider {
  readonly id = 'google' as const;
  readonly displayName = 'Google Drive';

  isConfigured(): boolean {
    return !!(
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
  }

  async ensureFolders(opts: { brand: string }): Promise<{
    folders?: { root?: string; foto?: string; video?: string; cerimonia?: string; ricevimento?: string };
    error?: string;
  }> {
    // NB: il caller deve passare l'access_token; questo metodo lo delega a tokens.ts
    // passando per la firma originale che richiede access_token. Refactoring minimo
    // richiesto in process-queue.ts per recuperare il token prima di chiamare.
    throw new Error('GoogleDriveProvider.ensureFolders richiede access_token — usa tokens.ts direttamente finché non si refactorizza la pipeline.');
  }

  async uploadFile(input: BackupUploadInput, token: { accessToken: string }): Promise<BackupUploadResult> {
    const { buffer, contentType, filename, parentFolderId, metadata } = input;
    const meta = {
      name: filename,
      parents: parentFolderId ? [parentFolderId] : undefined,
      ...(metadata as Record<string, unknown> | undefined),
    };
    const boundary = `----fotosposi${Date.now().toString(16)}`;
    const metaPart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(meta)}\r\n`;
    const fileHeader =
      `--${boundary}\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`;
    const closing = `\r\n--${boundary}--`;
    const bodyBytes = Buffer.concat([
      Buffer.from(metaPart, 'utf8'),
      Buffer.from(fileHeader, 'utf8'),
      buffer,
      Buffer.from(closing, 'utf8'),
    ]);
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2Csize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(bodyBytes.length),
        },
        body: bodyBytes,
        signal: AbortSignal.timeout(30000),
      },
    );
    const data = await res.json().catch(() => ({ error: { message: 'JSON parse failed' } }));
    if (!res.ok || !data.id) {
      throw new Error(`Drive upload fallito: HTTP ${res.status} ${data.error?.message || ''}`);
    }
    return { remoteFileId: data.id, bytes: data.size ?? buffer.length };
  }
}
