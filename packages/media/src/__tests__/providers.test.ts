import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// FIX 29/07/2026 — Test dell'interfaccia provider backup. Verifica che:
//   - GoogleDriveProvider: isConfigured richiede GOOGLE_OAUTH_CLIENT_ID/SECRET
//   - MegaProvider: stub, isConfigured richiede MEGA_EMAIL/PASSWORD, upload ritorna ProviderNotConfiguredError
//   - TeraboxProvider: stub, isConfigured richiede TERABOX_API_KEY/SECRET, upload ritorna ProviderNotConfiguredError
//   - selectBackupProvider: rispetta parametro esplicito > env BACKUP_PROVIDER > default "google"

describe('Provider backup — interfaccia BackupProvider (FIX 29/07/2026)', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('GoogleDriveProvider.isConfigured richiede GOOGLE_OAUTH_CLIENT_ID + SECRET', async () => {
    const { GoogleDriveProvider } = await import('../google-drive-provider');
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    expect(new GoogleDriveProvider().isConfigured()).toBe(false);
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'x';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'y';
    expect(new GoogleDriveProvider().isConfigured()).toBe(true);
  });

  it('MegaProvider (stub) richiede MEGA_EMAIL + MEGA_PASSWORD', async () => {
    const { MegaProvider } = await import('../mega-provider');
    delete process.env.MEGA_EMAIL;
    delete process.env.MEGA_PASSWORD;
    expect(new MegaProvider().isConfigured()).toBe(false);
    process.env.MEGA_EMAIL = 'a@b';
    process.env.MEGA_PASSWORD = 'pw';
    expect(new MegaProvider().isConfigured()).toBe(true);
  });

  it('MegaProvider.uploadFile senza env lancia ProviderNotConfiguredError', async () => {
    const { MegaProvider } = await import('../mega-provider');
    const { ProviderNotConfiguredError } = await import('../providers');
    delete process.env.MEGA_EMAIL;
    delete process.env.MEGA_PASSWORD;
    const p = new MegaProvider();
    await expect(
      p.uploadFile(
        { buffer: Buffer.from('x'), contentType: 'image/jpeg', filename: 'f.jpg', parentFolderId: 'r' },
        { accessToken: 'tok' },
      ),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it('TeraboxProvider (stub) richiede TERABOX_API_KEY + TERABOX_API_SECRET', async () => {
    const { TeraboxProvider } = await import('../terabox-provider');
    delete process.env.TERABOX_API_KEY;
    delete process.env.TERABOX_API_SECRET;
    expect(new TeraboxProvider().isConfigured()).toBe(false);
    process.env.TERABOX_API_KEY = 'k';
    process.env.TERABOX_API_SECRET = 's';
    expect(new TeraboxProvider().isConfigured()).toBe(true);
  });

  it('TeraboxProvider.uploadFile senza env lancia ProviderNotConfiguredError', async () => {
    const { TeraboxProvider } = await import('../terabox-provider');
    const { ProviderNotConfiguredError } = await import('../providers');
    delete process.env.TERABOX_API_KEY;
    delete process.env.TERABOX_API_SECRET;
    const p = new TeraboxProvider();
    await expect(
      p.uploadFile(
        { buffer: Buffer.from('x'), contentType: 'image/jpeg', filename: 'f.jpg', parentFolderId: 'r' },
        { accessToken: 'tok' },
      ),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError);
  });

  it('selectBackupProvider: default "google" se nessun env né override', async () => {
    const { selectBackupProvider } = await import('../providers');
    delete process.env.BACKUP_PROVIDER;
    const p = await selectBackupProvider();
    expect(p.id).toBe('google');
  });

  it('selectBackupProvider: BACKUP_PROVIDER env wins su default', async () => {
    const { selectBackupProvider } = await import('../providers');
    process.env.BACKUP_PROVIDER = 'mega';
    const p = await selectBackupProvider(null, { BACKUP_PROVIDER: process.env.BACKUP_PROVIDER });
    expect(p.id).toBe('mega');
  });

  it('selectBackupProvider: parametro esplicito wins su env', async () => {
    const { selectBackupProvider } = await import('../providers');
    process.env.BACKUP_PROVIDER = 'mega';
    const p = await selectBackupProvider('terabox', { BACKUP_PROVIDER: process.env.BACKUP_PROVIDER });
    expect(p.id).toBe('terabox');
  });

  it('ProviderNotConfiguredError contiene providerId e missingEnv', async () => {
    const { ProviderNotConfiguredError } = await import('../providers');
    const err = new ProviderNotConfiguredError('mega', ['MEGA_EMAIL', 'MEGA_PASSWORD']);
    expect(err.providerId).toBe('mega');
    expect(err.missingEnv).toEqual(['MEGA_EMAIL', 'MEGA_PASSWORD']);
    expect(err.message).toContain('MEGA_EMAIL');
    expect(err.message).toContain('MEGA_PASSWORD');
    expect(err.name).toBe('ProviderNotConfiguredError');
  });
});
