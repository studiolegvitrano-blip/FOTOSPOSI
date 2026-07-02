import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, rateLimit } from '@fotosposi/core';
import { createMediaRecord, getDriveToken, getEventDriveFolders, updateDriveSyncStatus } from '@fotosposi/media';
import { deleteObject, getPresignedDownloadUrl } from '@fotosposi/r2-storage';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rl = rateLimit(`process-queue:${ip}`, 30, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Troppe richieste' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  try {
    const { eventId } = await request.json();
    if (!eventId) return NextResponse.json({ error: 'eventId richiesto' }, { status: 400 });

    const supabase = createServiceClient();

    const { data: items } = await supabase
      .from('upload_queue')
      .select('*')
      .eq('event_id', eventId)
      .in('status', ['pending', 'failed'])
      .order('created_at', { ascending: true })
      .limit(5);

    if (!items || items.length === 0) {
      return NextResponse.json({ done: true, processed: 0 });
    }

    const [{ token }] = await Promise.all([getDriveToken(eventId)]);
    const hasDrive = !!token?.access_token;
    let folders: Record<string, string> | null = null;
    if (hasDrive) {
      const f = await getEventDriveFolders(eventId);
      folders = f.folders ?? null;
    }

    let processed = 0;
    for (const item of items) {
      try {
        await supabase.from('upload_queue').update({ status: 'processing' }).eq('id', item.id);

        const r2Key = item.r2_key;
        if (!r2Key) {
          await supabase.from('upload_queue').update({ status: 'failed', error: 'r2_key mancante' }).eq('id', item.id);
          continue;
        }

        const downloadUrl = await getPresignedDownloadUrl(r2Key, 900);
        if (!downloadUrl) {
          await supabase.from('upload_queue').update({ status: 'failed', error: 'Download R2 fallito' }).eq('id', item.id);
          continue;
        }

        const resp = await fetch(downloadUrl);
        if (!resp.ok) {
          await supabase.from('upload_queue').update({ status: 'failed', error: 'File su R2 non trovato' }).eq('id', item.id);
          continue;
        }

        const buffer = Buffer.from(await resp.arrayBuffer());

        const isVideo = item.file_type?.startsWith('video/');
        const { media, error: recordError } = await createMediaRecord({
          event_id: eventId,
          uploaded_by: item.uploaded_by,
          type: isVideo ? 'video' : 'photo',
          url: downloadUrl,
          compressed: item.compressed ?? false,
        });

        if (recordError || !media) {
          await supabase.from('upload_queue').update({ status: 'failed', error: recordError || 'Media record fallito' }).eq('id', item.id);
          continue;
        }

        if (hasDrive && folders) {
          try {
            const isVideo = item.file_type?.startsWith('video/');
            const driveFolderId = isVideo ? (folders['Video'] || folders['root']) : (folders['Foto'] || folders['root']);

            const formData = new FormData();
            const blob = new Blob([buffer], { type: item.file_type || 'application/octet-stream' });
            formData.append('file', blob, item.file_name);
            const metadata: Record<string, unknown> = { name: item.file_name };
            if (driveFolderId) metadata.parents = [driveFolderId];
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

            const driveRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id%2Csize', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token.access_token}` },
              body: formData,
              signal: AbortSignal.timeout(15000),
            });
            const driveData = await driveRes.json();
            if (driveRes.ok && driveData.id) {
              await updateDriveSyncStatus(media.id, 'synced', driveData.id);
              await deleteObject(r2Key);
              await supabase.from('upload_queue').update({ status: 'synced', drive_file_id: driveData.id, processed_at: new Date().toISOString() }).eq('id', item.id);
            } else {
              await updateDriveSyncStatus(media.id, 'failed');
              await supabase.from('upload_queue').update({ status: 'synced', error: 'Drive sync fallito' }).eq('id', item.id);
            }
          } catch {
            await updateDriveSyncStatus(media.id, 'failed');
            await supabase.from('upload_queue').update({ status: 'synced', error: 'Drive sync fallito' }).eq('id', item.id);
          }
        } else {
          await supabase.from('upload_queue').update({ status: 'synced', processed_at: new Date().toISOString() }).eq('id', item.id);
        }
        processed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Errore';
        await supabase.from('upload_queue').update({ status: 'failed', error: msg, retry_count: (item.retry_count || 0) + 1 }).eq('id', item.id);
      }
    }

    return NextResponse.json({ done: false, processed, remaining: items.length - processed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
