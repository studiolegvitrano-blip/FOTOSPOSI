import { NextRequest, NextResponse } from 'next/server';
import { updateDiaryEntry, deleteDiaryEntry } from '@fotosposi/work-diary';

export async function PATCH(req: NextRequest) {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  const entryId = parts.at(-1);
  if (!entryId) return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });

  const body = await req.json();
  const { entry, error } = await updateDiaryEntry(entryId, body);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ entry });
}

export async function DELETE(req: NextRequest) {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  const entryId = parts.at(-1);
  if (!entryId) return NextResponse.json({ error: 'Missing entryId' }, { status: 400 });

  const { error } = await deleteDiaryEntry(entryId);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
