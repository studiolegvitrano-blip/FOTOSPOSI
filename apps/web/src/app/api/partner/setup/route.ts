import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, email, name, company, phone, website, address, gdprConsent } = await req.json();
  if (!userId || !email || !name) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
  }
  if (!gdprConsent) {
    return NextResponse.json({ error: 'Consenso privacy obbligatorio mancante' }, { status: 400 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Il profilo partner ha FK user_id → core_users: l'account deve esistere.
  // Per gli sposi lo crea /api/auth/setup; qui lo creiamo con role 'partner'.
  const { data: existing } = await supabase
    .from('core_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!existing) {
    const { error: tenantErr } = await supabase.from('core_tenants').insert({
      id: userId,
      brand: 'fotosposi',
      locale: 'it',
      name: `${name} - Partner`,
    });
    if (tenantErr && !tenantErr.message.includes('duplicate key')) {
      return NextResponse.json({ error: tenantErr.message }, { status: 500 });
    }

    const { error: userErr } = await supabase.from('core_users').insert({
      id: userId,
      email,
      name,
      first_name: name,
      role: 'partner',
      tenant_id: userId,
    });
    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
  }

  // Link automatico a un collaboratore esistente (affiliates) con la stessa email:
  // il partner accede con lo stesso account e vede le sue commissioni nel portale.
  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id')
    .ilike('email', email.trim())
    .maybeSingle();

  const { data: partner, error: partnerErr } = await supabase
    .from('partners')
    .insert({
      user_id: userId,
      name,
      company: company ?? null,
      email: email.trim(),
      phone: phone ?? null,
      website: website ?? null,
      address: address ?? null,
      affiliate_id: affiliate?.id ?? null,
    })
    .select()
    .single();

  if (partnerErr) {
    return NextResponse.json({ error: partnerErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, partner });
}
