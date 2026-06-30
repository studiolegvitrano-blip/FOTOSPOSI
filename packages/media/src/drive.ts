import { SignJWT } from 'jose';
import { updateDriveSyncStatus } from './service';

interface DriveCredentials {
  clientEmail: string;
  privateKey: string;
}

function getCredentials(): DriveCredentials | null {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) return null;
  return { clientEmail, privateKey };
}

export async function syncToDrive(
  mediaId: string,
  fileUrl: string,
  fileName: string,
  folderId?: string,
): Promise<{ fileId?: string; error?: string }> {
  const creds = getCredentials();
  if (!creds) {
    await updateDriveSyncStatus(mediaId, 'pending');
    return { error: 'Google Drive non configurato. Configura GOOGLE_DRIVE_CLIENT_EMAIL e GOOGLE_DRIVE_PRIVATE_KEY.' };
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      await updateDriveSyncStatus(mediaId, 'failed');
      return { error: 'Impossibile scaricare il file da Supabase Storage' };
    }

    const blob = await response.blob();
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const metadata = { name: fileName, parents: folderId ? [folderId] : [] };
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

    const accessToken = await getGoogleAccessToken(creds);
    const driveResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      },
    );

    if (!driveResponse.ok) {
      await updateDriveSyncStatus(mediaId, 'failed');
      return { error: `Google Drive API error: ${driveResponse.statusText}` };
    }

    const result = await driveResponse.json();
    await updateDriveSyncStatus(mediaId, 'synced', result.id);
    return { fileId: result.id };
  } catch (err) {
    await updateDriveSyncStatus(mediaId, 'failed');
    return { error: String(err) };
  }
}

async function getGoogleAccessToken(creds: DriveCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = creds.privateKey.includes('\\n')
    ? creds.privateKey.replace(/\\n/g, '\n')
    : creds.privateKey;

  const jwt = await new SignJWT({
    iss: creds.clientEmail,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(await importKey(privateKey));

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  return data.access_token;
}

async function importKey(pem: string): Promise<any> {
  const { importPKCS8 } = await import('jose');
  const pemContents = pem.includes('-----BEGIN PRIVATE KEY-----')
    ? pem
    : `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`;
  return importPKCS8(pemContents, 'RS256');
}
