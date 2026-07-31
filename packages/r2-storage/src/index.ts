export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl?: string;
}

export const defaultConfig = (): R2Config => ({
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET || 'fotosposi-uploads',
  publicUrl: process.env.R2_PUBLIC_URL || '',
});

export function getEndpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export {
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  downloadObjectBuffer,
  uploadFromBuffer,
  deleteObject,
  objectExists,
  listObjectsByPrefix,
} from './r2';