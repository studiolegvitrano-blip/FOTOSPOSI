import { createServiceClient } from '@fotosposi/core';

export interface EventDriveToken {
  id: string;
  event_id: string;
  access_token: string;
  refresh_token: string | null;
  token_type: string;
  expires_at: string;
  drive_email: string | null;
  created_at: string;
  updated_at: string;
}

export async function saveDriveToken(params: {
  event_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  drive_email?: string;
}): Promise<{ token?: EventDriveToken; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_drive_tokens')
    .upsert({
      event_id: params.event_id,
      access_token: params.access_token,
      refresh_token: params.refresh_token,
      token_type: 'Bearer',
      expires_at: params.expires_at,
      drive_email: params.drive_email ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' })
    .select()
    .single();
  if (error) return { error: error.message };
  return { token: data };
}

export async function getDriveToken(eventId: string): Promise<{ token?: EventDriveToken; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_drive_tokens')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) return { error: error.message };
  return { token: data ?? undefined };
}

export async function deleteDriveToken(eventId: string): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('event_drive_tokens').delete().eq('event_id', eventId);
  if (error) return { error: error.message };
  return {};
}

export interface DriveFolderMap {
  root?: string;
  foto?: string;
  video?: string;
  ricevimento?: string;
  cerimonia?: string;
}

const DRIVE_FOLDERS = ['Foto', 'Video', 'Ricevimento', 'Cerimonia'];

export async function ensureDriveFolders(accessToken: string): Promise<{ folders?: DriveFolderMap; error?: string }> {
  const brand = 'WeddingMoments';
  const folders: DriveFolderMap = {};

  try {
    const rootRes = await fetch('https://www.googleapis.com/drive/v3/files?q=name%3D%27' + encodeURIComponent(brand) + '%27%20and%20mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&fields=files(id,name)', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const rootData = await rootRes.json();
    let rootId = rootData.files?.[0]?.id;

    if (!rootId) {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: brand, mimeType: 'application/vnd.google-apps.folder' }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) return { error: createData.error?.message || 'Folder creation failed' };
      rootId = createData.id;
    }

    folders.root = rootId;

    for (const f of DRIVE_FOLDERS) {
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name%3D%27${encodeURIComponent(f)}%27%20and%20%27${rootId}%27%20in%20parents%20and%20mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const searchData = await searchRes.json();
      let folderId = searchData.files?.[0]?.id;

      if (!folderId) {
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: f, mimeType: 'application/vnd.google-apps.folder', parents: [rootId] }),
        });
        const createData = await createRes.json();
        if (createRes.ok) folderId = createData.id;
      }

      if (folderId) {
        const key = f.toLowerCase() as keyof DriveFolderMap;
        folders[key] = folderId;
      }
    }

    return { folders };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Drive folder setup failed' };
  }
}

export async function getEventDriveFolders(eventId: string): Promise<{ folders?: Record<string, string>; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('event_drive_folders')
    .select('folder_name, folder_id')
    .eq('event_id', eventId);
  if (error) return { error: error.message };
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.folder_name] = row.folder_id;
  }
  return { folders: map };
}

export async function refreshDriveAccessToken(refreshToken: string): Promise<{ access_token?: string; error?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (data.error) return { error: data.error_description || data.error };
  return { access_token: data.access_token };
}
