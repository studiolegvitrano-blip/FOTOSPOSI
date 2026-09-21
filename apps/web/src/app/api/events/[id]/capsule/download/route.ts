import { NextRequest, NextResponse } from 'next/server';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';
import { authorizeCapsuleAccess } from '@/lib/capsule-auth';

type Params = { params: Promise<{ id: string }> };

/** POST {r2Key} — presigned download del video capsula (per il client). */
export async function POST(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const auth = await authorizeCapsuleAccess(eventId);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => ({})) as { r2Key?: string };
  if (!body.r2Key) return NextResponse.json({ error: 'Missing r2Key' }, { status: 400 });
  const url = await getPresignedDownloadUrl(body.r2Key, 3600);
  if (!url) return NextResponse.json({ error: 'Download non disponibile' }, { status: 404 });
  return NextResponse.json({ url });
}
