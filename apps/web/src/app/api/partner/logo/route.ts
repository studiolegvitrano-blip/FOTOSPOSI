import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@fotosposi/core';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerSideClient(() => cookieStore.getAll());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { data: partner, error: pErr } = await supabase
    .from('partners')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!partner) return NextResponse.json({ error: 'Profilo partner non trovato' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('logo') as File | null;
  if (!file) return NextResponse.json({ error: 'File mancante' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const allowed = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
  if (!allowed.includes(ext)) {
    return NextResponse.json({ error: 'Formato non supportato (png/jpg/webp/svg)' }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: 'File troppo grande (max 2MB)' }, { status: 400 });
  }

  const path = `partner-logos/${partner.id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from('media')
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);

  const { error: updErr } = await supabase
    .from('partners')
    .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', partner.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ logo_url: urlData.publicUrl });
}
