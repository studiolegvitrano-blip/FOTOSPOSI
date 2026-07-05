import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId, email, name, firstName, lastName, phone, gdprConsent, marketingConsent, eventId } = await req.json();
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

  // Chi crea il proprio evento (sposi/amministratori) vs chi si registra da un invito/QR
  // (invitati, il cui compito è caricare foto/video) sono due percorsi diversi: prima venivano
  // trattati allo stesso modo (sempre role 'sposo', senza event_id), quindi un invitato che si
  // registrava non risultava mai socio/membro dell'evento a cui era stato invitato — vedeva
  // "nessun evento" in dashboard e le policy RLS su media_uploads/event_windows (che controllano
  // core_users.event_id) bloccavano anche il caricamento foto una volta tornato sulla pagina giusta.
  let event: { tenant_id: string } | null = null;
  if (eventId) {
    const { data } = await supabase.from('events').select('tenant_id').eq('id', eventId).maybeSingle();
    event = data;
  }

  const { data: existing } = await supabase
    .from('core_users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true });
  }

  if (event) {
    // Invitato: nessun tenant proprio, appartiene al tenant dell'evento a cui è stato invitato.
    const { error: guestErr } = await supabase.from('core_users').insert({
      id: userId,
      email,
      name,
      first_name: firstName ?? null,
      last_name: lastName ?? null,
      phone: phone ?? null,
      gdpr_consent_at: new Date().toISOString(),
      marketing_consent: !!marketingConsent,
      role: 'invitato',
      tenant_id: event.tenant_id,
      event_id: eventId,
    });
    if (guestErr) {
      return NextResponse.json({ error: guestErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Sposo/amministratore: crea il proprio tenant (account "azienda" del matrimonio).
  const { error: tenantErr } = await supabase.from('core_tenants').insert({
    id: userId,
    brand: 'fotosposi',
    locale: 'it',
    name: `${name} - Matrimonio`,
  });

  if (tenantErr && !tenantErr.message.includes('duplicate key')) {
    return NextResponse.json({ error: tenantErr.message }, { status: 500 });
  }

  const { error: userErr } = await supabase.from('core_users').insert({
    id: userId,
    email,
    name,
    first_name: firstName ?? null,
    last_name: lastName ?? null,
    phone: phone ?? null,
    gdpr_consent_at: new Date().toISOString(),
    marketing_consent: !!marketingConsent,
    role: 'sposo',
    tenant_id: userId,
  });

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
