import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';

export async function POST(req: NextRequest) {
  const eventId = req.nextUrl.pathname.split('/').filter(Boolean).at(-2);
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

  const supabase = createServiceClient();
  const path = `capsule/${eventId}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(data.path);

  return NextResponse.json({ url: urlData.publicUrl, path: data.path });
}
