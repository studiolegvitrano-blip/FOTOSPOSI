import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@fotosposi/core';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
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

  const { data: codes, error: cErr } = await supabase
    .from('partner_codes')
    .select('*')
    .eq('partner_id', partner.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  return NextResponse.json({ codes: codes ?? [] });
}
