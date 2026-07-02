import { NextRequest, NextResponse } from 'next/server';
import { deleteObject } from '@fotosposi/r2-storage';

export async function POST(request: NextRequest) {
  try {
    const { key } = await request.json();

    if (!key) {
      return NextResponse.json({ error: 'key richiesta' }, { status: 400 });
    }

    const ok = await deleteObject(key);

    return NextResponse.json({ deleted: ok });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
