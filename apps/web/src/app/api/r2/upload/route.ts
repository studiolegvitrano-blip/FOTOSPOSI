import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@fotosposi/r2-storage';
import { rateLimit, createServiceClient } from '@fotosposi/core';

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
};
const ALLOWED_TYPES_FLAT = [...(ALLOWED_TYPES['image'] ?? []), ...(ALLOWED_TYPES['video'] ?? [])];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.mp4', '.mov', '.webm'];
const MAX_FILE_SIZE = 200 * 1024 * 1024;

function validateFile(filename: string, contentType: string): string | null {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'Estensione file non consentita';
  if (!ALLOWED_TYPES_FLAT.includes(contentType)) return 'Tipo MIME non consentito';
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\'))
    return 'Filename non valido';
  return null;
}

/**
 * Risolve il prefix R2 per un evento: usa `events.r2_folder_name` se presente
 * (formato user-friendly "YYYY_MM_DD_Surname1_Surname2"), altrimenti fallback
 * al UUID `events/{eventId}` (compatibilità eventi creati prima di questa feature).
 * Il client può passare `eventId` nella request body; altrimenti usa `prefix` raw.
 */
async function resolvePrefix(
  eventId: string | undefined,
  clientPrefix: string | undefined,
): Promise<string> {
  if (!eventId) return clientPrefix || 'uploads';
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('events')
      .select('r2_folder_name')
      .eq('id', eventId)
      .maybeSingle();
    if (data?.r2_folder_name) return `events/${data.r2_folder_name}`;
    // fallback UUID legacy
    return clientPrefix || `events/${eventId}`;
  } catch {
    return clientPrefix || 'uploads';
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const rl = rateLimit(`r2-upload:${ip}`, 30, 60000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Troppe richieste. Riprova tra qualche secondo.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
      );
    }

    const { filename, contentType, prefix, fileSize, eventId } = await request.json();
    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename e contentType richiesti' }, { status: 400 });
    }

    const validationError = validateFile(filename, contentType);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File troppo grande (max 200MB)' }, { status: 400 });
    }

    const resolvedPrefix = await resolvePrefix(eventId, prefix);
    const result = await getPresignedUploadUrl(
      resolvedPrefix,
      filename,
      contentType,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      key: result.key,
      url: result.url,
      presignedUrl: result.presignedUrl,
      prefix: resolvedPrefix,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
