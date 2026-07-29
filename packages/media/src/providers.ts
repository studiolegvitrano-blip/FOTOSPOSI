/**
 * FIX 29/07/2026 — Interfaccia astratta provider backup cloud.
 *
 * Supportiamo Google Drive (default) + MEGA + Terabox come provider alternativi
 * per il backup dei media degli sposi. L'interfaccia `BackupProvider` permette
 * di aggiungere nuovi provider senza toccare `process-queue.ts`.
 *
 * Stato attuale (29/07/2026):
 *   - GoogleDriveProvider: ATTIVO (vedi google-drive-provider.ts, riusa tokens.ts).
 *   - MegaProvider: STUB — ritorna `ProviderNotConfiguredError` finché MEGA_API_KEY
 *     non è configurata su Vercel. Per implementare: MEGA espone
 *     https://g.api.mega.co.nz/ (cmd sc/api). Wrapper npm consigliato: `megajs`.
 *   - TeraboxProvider: STUB — ritorna `ProviderNotConfiguredError` finché
 *     TERABOX_API_KEY non è configurata. Per implementare: Terabox usa un
 *     protocollo proprietario su https://www.terabox.com/ — la libreria Python
 *     `terabox-upload` mostra i dettagli (porting richiede reverse-engineering).
 *
 * Le env vars attese (vedi AGENTS.md):
 *   - DRIVE_PROVIDER: "google" (default) | "mega" | "terabox" (selezione per evento)
 *   - MEGA_EMAIL, MEGA_PASSWORD, MEGA_API_KEY (per provider MegaProvider reale)
 *   - TERABOX_API_KEY, TERABOX_API_SECRET (per provider TeraboxProvider reale)
 */

export type BackupProviderId = 'google' | 'mega' | 'terabox';

/**
 * Risultato standard di un upload provider-agnostico.
 * Su Google Drive, `remoteFileId` è il Drive file id; su MEGA sarà il node handle;
 * su Terabox sarà il fs_id. La forma `key=val` del Drive file id (es. "1abc...")
 * si presta bene a tutti i provider.
 */
export interface BackupUploadResult {
  remoteFileId: string;
  remoteUrl?: string;     // URL diretto al file (per anteprima opzionale)
  bytes?: number;         // bytes effettivamente scritti lato provider
}

export interface BackupUploadInput {
  /** Body del file (foto o video). */
  buffer: Buffer;
  contentType: string;
  /** Nome file finale sul provider (es. "20260727_143015_Giuseppe_DSC_0001.jpg"). */
  filename: string;
  /** ID cartella di destinazione sul provider (es. folder_id Drive, node handle MEGA). */
  parentFolderId: string;
  /** Metadati extra opzionali (es. description, starred, ecc.). */
  metadata?: Record<string, unknown>;
}

export interface BackupProvider {
  readonly id: BackupProviderId;
  readonly displayName: string;
  /** True se le env vars necessarie sono presenti e il provider può operare. */
  isConfigured(): boolean;
  /** Crea/allega folder root + sotto-folder Foto/Video/Cerimonia/Ricevimento. */
  ensureFolders(opts: { brand: string }): Promise<{
    folders?: { root?: string; foto?: string; video?: string; cerimonia?: string; ricevimento?: string };
    error?: string;
  }>;
  /** Upload di un singolo file. */
  uploadFile(input: BackupUploadInput, token: { accessToken: string }): Promise<BackupUploadResult>;
}

/**
 * Errore specifico provider non configurato (env vars mancanti).
 * Catturato da process-queue.ts → fallback graceful: la foto resta su R2 (visibile
 * in galleria) e il badge "Backup temporaneo" avvisa l'utente.
 */
export class ProviderNotConfiguredError extends Error {
  public readonly providerId: BackupProviderId;
  public readonly missingEnv: string[];
  constructor(providerId: BackupProviderId, missingEnv: string[]) {
    super(`Provider backup '${providerId}' non configurato: mancano env ${missingEnv.join(', ')}`);
    this.name = 'ProviderNotConfiguredError';
    this.providerId = providerId;
    this.missingEnv = missingEnv;
  }
}

/**
 * Seleziona il provider di backup in base a env o argomento esplicito.
 * Ordine di priorità:
 *   1. parametro esplicito `requestedProviderId` (override per evento)
 *   2. env `BACKUP_PROVIDER` (default globale)
 *   3. fallback "google" (sempre configurato se hai OAuth funzionante)
 *
 * Lazy import dei moduli provider per evitare cicli (google-drive-provider
 * riusa tokens.ts).
 */
export async function selectBackupProvider(
  requestedProviderId?: BackupProviderId | null,
  envOverride?: { BACKUP_PROVIDER?: string },
): Promise<BackupProvider> {
  const id =
    requestedProviderId ??
    (envOverride?.BACKUP_PROVIDER as BackupProviderId | undefined) ??
    'google';
  switch (id) {
    case 'google':
      const { GoogleDriveProvider } = await import('./google-drive-provider');
      return new GoogleDriveProvider();
    case 'mega':
      const { MegaProvider } = await import('./mega-provider');
      return new MegaProvider();
    case 'terabox':
      const { TeraboxProvider } = await import('./terabox-provider');
      return new TeraboxProvider();
    default:
      throw new Error(`Provider backup sconosciuto: ${id}`);
  }
}
