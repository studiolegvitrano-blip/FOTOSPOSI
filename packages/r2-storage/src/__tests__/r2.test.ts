import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn();

vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: class {
      send = vi.fn();
      constructor() { this.send = mockSend; }
    },
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn(),
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

vi.mock('../index', () => ({
  defaultConfig: () => ({
    accountId: 'test-account',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    bucket: 'test-bucket',
    publicUrl: 'https://public.test.com',
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const { getPresignedUploadUrl, getPresignedDownloadUrl, uploadFromBuffer, deleteObject, objectExists } = await import('../r2');

describe('getPresignedUploadUrl', () => {
  it('genera presigned URL con successo', async () => {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    (getSignedUrl as any).mockResolvedValue('https://presigned.test.com/upload');

    const result = await getPresignedUploadUrl('uploads', 'foto.jpg', 'image/jpeg');
    expect(result.success).toBe(true);
    expect(result.presignedUrl).toBe('https://presigned.test.com/upload');
    expect(result.key).toContain('foto.jpg');
  });

  it('ritorna errore se getSignedUrl fallisce', async () => {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    (getSignedUrl as any).mockRejectedValue(new Error('Network error'));

    const result = await getPresignedUploadUrl('uploads', 'f.jpg', 'image/jpeg');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('ritorna errore se config manca', async () => {
    const mod = await import('../index');
    vi.spyOn(mod, 'defaultConfig').mockReturnValueOnce({
      accountId: '', accessKeyId: '', secretAccessKey: '', bucket: 'test', publicUrl: '',
    });
    const result = await getPresignedUploadUrl('u', 'f.jpg', 'image/jpeg');
    expect(result.success).toBe(false);
    expect(result.error).toBe('R2 non configurato');
  });
});

describe('uploadFromBuffer', () => {
  it('carica buffer con successo', async () => {
    mockSend.mockResolvedValue({});
    const result = await uploadFromBuffer(Buffer.from('test'), 'uploads', 'doc.pdf', 'application/pdf');
    expect(result.success).toBe(true);
    expect(result.key).toContain('doc.pdf');
  });

  it('ritorna errore se send fallisce', async () => {
    mockSend.mockRejectedValue(new Error('Upload failed'));
    const result = await uploadFromBuffer(Buffer.from('test'), 'uploads', 'doc.pdf', 'application/pdf');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Upload failed');
  });

  it('ritorna errore se config manca', async () => {
    const mod = await import('../index');
    vi.spyOn(mod, 'defaultConfig').mockReturnValueOnce({
      accountId: '', accessKeyId: '', secretAccessKey: '', bucket: 'test', publicUrl: '',
    });
    const result = await uploadFromBuffer(Buffer.from('t'), 'u', 'f.pdf', 'application/pdf');
    expect(result.success).toBe(false);
  });
});

describe('getPresignedDownloadUrl', () => {
  it('ritorna URL presigned', async () => {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    (getSignedUrl as any).mockResolvedValue('https://download.test.com/file');
    const url = await getPresignedDownloadUrl('key1');
    expect(url).toBe('https://download.test.com/file');
  });

  it('ritorna null se fallisce', async () => {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    (getSignedUrl as any).mockRejectedValue(new Error('error'));
    const url = await getPresignedDownloadUrl('key1');
    expect(url).toBeNull();
  });
});

describe('deleteObject', () => {
  it('cancella con successo', async () => {
    mockSend.mockResolvedValue({});
    const result = await deleteObject('key1');
    expect(result).toBe(true);
  });

  it('ritorna false se fallisce', async () => {
    mockSend.mockRejectedValue(new Error('error'));
    const result = await deleteObject('key1');
    expect(result).toBe(false);
  });
});

describe('objectExists', () => {
  it('ritorna true se esiste', async () => {
    mockSend.mockResolvedValue({});
    const result = await objectExists('key1');
    expect(result).toBe(true);
  });

  it('ritorna false se non esiste', async () => {
    mockSend.mockRejectedValue(new Error('Not found'));
    const result = await objectExists('key1');
    expect(result).toBe(false);
  });
});
