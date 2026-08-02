import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
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

/**
 * FIX 31/07/2026: scarica un oggetto R2 direttamente via SDK (GetObjectCommand + stream)
 * invece di generare una presigned URL. Su Vercel lambda il presigner di @aws-sdk/
 * s3-request-presigner@3.1078.0 cadeva in "b is not a function" (webpack tree-shaking
 * errato del middleware stack), quindi `getPresignedDownloadUrl` ritornava sempre null
 * e la galleria non poteva più visualizzare nessuna foto/video. Questa funzione bypassa
 * quel problema usando solo il client S3 base.
 */
export async function downloadObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const cfg = defaultConfig();
    const obj = await getClient().send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
    if (!obj.Body) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of obj.Body as AsyncIterable<Buffer>) chunks.push(chunk);
    return Buffer.concat(chunks);
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

/**
 * FIX 29/07/2026 — Lista ricorsivamente tutti gli oggetti sotto un prefisso R2.
 * Usato dallo script "orfani R2" per enumerare oggetti e confrontarli con i
 * r2_key presenti in media_uploads.
 *
 * R2 (S3-compatible) ha un limite di 1000 oggetti per ListObjectsV2 call —
 * gestiamo la paginazione automaticamente con `ContinuationToken`.
 *
 * @param prefix Prefisso R2 (es. "events/2026_07_30_Agostino_Danila/" o "originals/")
 * @param maxKeys Limite di sicurezza per evitare OOM se il bucket ha milioni di oggetti
 *                (default 100k). Restituisce `{truncated: true}` se fermato prima.
 */
export async function listObjectsByPrefix(
  prefix: string,
  maxKeys = 100000,
): Promise<{ keys: string[]; truncated: boolean; error?: string }> {
  const keys: string[] = [];
  let token: string | undefined = undefined;
  const cfg = defaultConfig();
  try {
    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      });
      const res = await getClient().send(command);
      for (const obj of res.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
        if (keys.length >= maxKeys) return { keys, truncated: true };
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return { keys, truncated: false };
  } catch (e) {
    return { keys, truncated: false, error: e instanceof Error ? e.message : 'ListObjects failed' };
  }
}

/**
 * CEO dashboard — Lista ricorsivamente gli oggetti sotto un prefisso R2 con la
 * loro dimensione in byte (per calcolare la memoria occupata per evento/folder).
 *
 * `ListObjectsV2` ritorna `Size` per ogni oggetto; `listObjectsByPrefix` li
 * scarta. Questa variante li conserva. Stessa paginazione automatica (1000/chunk).
 */
export async function listObjectsWithSizes(
  prefix: string,
  maxKeys = 100000,
): Promise<{ objects: Array<{ key: string; size: number }>; truncated: boolean; error?: string }> {
  const objects: Array<{ key: string; size: number }> = [];
  let token: string | undefined = undefined;
  const cfg = defaultConfig();
  try {
    do {
      const command: ListObjectsV2Command = new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      });
      const res = await getClient().send(command);
      for (const obj of res.Contents ?? []) {
        if (obj.Key) objects.push({ key: obj.Key, size: obj.Size ?? 0 });
        if (objects.length >= maxKeys) return { objects, truncated: true };
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return { objects, truncated: false };
  } catch (e) {
    return { objects, truncated: false, error: e instanceof Error ? e.message : 'ListObjects failed' };
  }
}

function getPublicBase(cfg: ReturnType<typeof defaultConfig>): string {
  return cfg.publicUrl || `https://${cfg.bucket}.${cfg.accountId}.r2.cloudflarestorage.com`;
}
