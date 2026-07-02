import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { defaultConfig } from './index';

let client: S3Client | null = null;

function getClient() {
  if (client) return client;
  const cfg = defaultConfig();
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    requestHandler: {
      requestTimeout: 30000,
    },
  });
  return client;
}

export type UploadResult = { success: true; key: string; url: string } | { success: false; error: string };

function safeKey(prefix: string, filename: string): string {
  const clean = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ts = Date.now();
  return `${prefix.replace(/\/$/,'')}/${ts}_${clean}`;
}

export async function getPresignedUploadUrl(
  prefix: string,
  filename: string,
  contentType: string,
): Promise<UploadResult & { presignedUrl?: string }> {
  try {
    const cfg = defaultConfig();
    if (!cfg.accountId || !cfg.accessKeyId || !cfg.secretAccessKey) {
      return { success: false, error: 'R2 non configurato' };
    }
    const key = safeKey(prefix, filename);
    const command = new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType });
    const presignedUrl = await getSignedUrl(getClient(), command, { expiresIn: 3600 });
    return { success: true, key, url: `${getPublicBase(cfg)}/${key}`, presignedUrl };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore presigned URL' };
  }
}

export async function getPresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string | null> {
  try {
    const cfg = defaultConfig();
    const command = new GetObjectCommand({ Bucket: cfg.bucket, Key: key });
    return await getSignedUrl(getClient(), command, { expiresIn });
  } catch {
    return null;
  }
}

export async function uploadFromBuffer(
  buffer: Buffer,
  prefix: string,
  filename: string,
  contentType: string,
): Promise<UploadResult> {
  try {
    const cfg = defaultConfig();
    if (!cfg.accountId || !cfg.accessKeyId || !cfg.secretAccessKey) {
      return { success: false, error: 'R2 non configurato' };
    }
    const key = safeKey(prefix, filename);
    const command = new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });
    await getClient().send(command);
    return { success: true, key, url: `${getPublicBase(cfg)}/${key}` };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore upload' };
  }
}

export async function deleteObject(key: string): Promise<boolean> {
  try {
    const cfg = defaultConfig();
    const command = new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key });
    await getClient().send(command);
    return true;
  } catch {
    return false;
  }
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    const cfg = defaultConfig();
    const command = new HeadObjectCommand({ Bucket: cfg.bucket, Key: key });
    await getClient().send(command);
    return true;
  } catch {
    return false;
  }
}

function getPublicBase(cfg: ReturnType<typeof defaultConfig>): string {
  return cfg.publicUrl || `https://${cfg.bucket}.${cfg.accountId}.r2.cloudflarestorage.com`;
}
