import { NextRequest, NextResponse } from 'next/server';
import { getPresignedUploadUrl } from '@fotosposi/r2-storage';
import { rateLimit } from '@fotosposi/core';

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

    const { filename, contentType, prefix } = await request.json();

    if (!filename || !contentType) {
      return NextResponse.json({ error: 'filename e contentType richiesti' }, { status: 400 });
    }

    const result = await getPresignedUploadUrl(
      prefix || 'uploads',
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
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
