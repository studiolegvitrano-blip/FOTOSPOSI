import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@fotosposi/core';
import { cookies } from 'next/headers';
import { generatePartnerCodes } from '@fotosposi/partner';

export async function POST(req: NextRequest) {
  const { tier, quantity } = await req.json();
  if (tier !== 'premium' && tier !== 'deluxe') {
    return NextResponse.json({ error: 'Tier non valido' }, { status: 400 });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return NextResponse.json({ error: 'Quantità non valida (1-100)' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerSideClient(() => cookieStore.getAll());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { data: partner, error: pErr } = await supabase
    .from('partners')
    .select('id, is_active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
  if (!partner || !partner.is_active) {
    return NextResponse.json({ error: 'Profilo partner non attivo' }, { status: 403 });
  }

  // TODO Fase 4: bloccare la generazione finché il pagamento (Stripe/IBAN) non è confermato.
  // Per ora generiamo direttamente i codici del pacchetto.
  const { codes, error } = await generatePartnerCodes(partner.id, quantity, quantity);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ codes: codes ?? [] });
}
