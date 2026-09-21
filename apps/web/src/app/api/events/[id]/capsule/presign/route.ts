import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@fotosposi/r2-storage';
import { authorizeCapsuleAccess } from '@/lib/capsule-auth';

const MAX_VIDEO_BYTES = 256 * 1024 * 1024;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const auth = await authorizeCapsuleAccess(eventId);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => ({})) as {
    filename?: string;
    contentType?: string;
    fileSize?: number;
  };

  if (!body.filename || !body.contentType?.startsWith('video/')) {
    return NextResponse.json({ error: 'File video richiesto' }, { status: 400 });
  }
  if ((body.fileSize ?? 0) > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: 'Video troppo grande (max 256MB)' }, { status: 413 });
  }

  const result = await getPresignedUploadUrl(`events/${eventId}/capsules`, body.filename, body.contentType);
  if (!result.success || !result.presignedUrl) {
    return NextResponse.json({ error: (!result.success ? result.error : undefined) || 'Presign fallito' }, { status: 500 });
  }
  return NextResponse.json({ presignedUrl: result.presignedUrl, key: result.key });
}
