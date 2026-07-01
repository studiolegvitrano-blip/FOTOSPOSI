import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, email, name } = await req.json();
  if (!userId || !email || !name) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error: tenantErr } = await supabase.from('core_tenants').insert({
    id: userId,
    brand: 'fotosposi',
    locale: 'it',
    name: `${name} - Matrimonio`,
  });

  if (tenantErr && !tenantErr.message.includes('duplicate key')) {
    return NextResponse.json({ error: tenantErr.message }, { status: 500 });
  }

  const { data: existing } = await supabase
    .from('core_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!existing) {
    const { error: userErr } = await supabase.from('core_users').insert({
      id: userId,
      email,
      name,
      role: 'sposo',
      tenant_id: userId,
    });

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
