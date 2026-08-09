import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@fotosposi/core';
import { cookies } from 'next/headers';

/**
 * Riscatta un codice partner per l'evento corrente (white label).
 * Il codice è legato all'evento: chi crea l'evento (created_by) è l'utente auth.
 */
export async function POST(req: NextRequest) {
  const { code, eventId } = await req.json();
  if (!code || !eventId) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerSideClient(() => cookieStore.getAll());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  // Il codice deve essere riscattabile e l'evento deve appartenere all'utente.
  const { data: codeRow, error: codeErr } = await supabase
    .from('partner_codes')
    .select('id, partner_id, status')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle();
  if (codeErr) return NextResponse.json({ error: codeErr.message }, { status: 500 });
  if (!codeRow || codeRow.status !== 'available') {
    return NextResponse.json({ error: 'Codice non valido o già utilizzato' }, { status: 400 });
  }

  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, created_by')
    .eq('id', eventId)
    .maybeSingle();
  if (evErr) return NextResponse.json({ error: evErr.message }, { status: 500 });
  if (!event || event.created_by !== user.id) {
    return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
  }

  // Set partner_id sull'evento (white label).
  const { error: updErr } = await supabase
    .from('events')
    .update({ partner_id: codeRow.partner_id as string })
    .eq('id', eventId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  // Marca il codice come usato.
  const { error: useErr } = await supabase
    .from('partner_codes')
    .update({
      status: 'used',
      redeemed_event_id: eventId,
      redeemed_by: user.id,
      redeemed_at: new Date().toISOString(),
    })
    .eq('id', codeRow.id as string);
  if (useErr) return NextResponse.json({ error: useErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
