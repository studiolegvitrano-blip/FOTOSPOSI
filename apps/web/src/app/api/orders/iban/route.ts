import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@fotosposi/core';
import { createIbanOrder } from '@fotosposi/commerce';
import { cookies } from 'next/headers';

/**
 * Crea un ordine pagabile con bonifico (IBAN).
 * Body: { eventId?, total, currency?, metadata? }
 * eventId è opzionale (null per ordini personali tipo pacchetti partner).
 * Ritorna l'ordine pending + la causale univoca + le coordinate bancarie
 * (lette server-side da platform_settings, MAI esposte via API pubbliche).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { eventId, total, currency, metadata } = body;
  if (typeof total !== 'number' || total <= 0) {
    return NextResponse.json({ error: 'total (positivo) obbligatorio' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerSideClient(() => cookieStore.getAll());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { order, reference, iban, error } = await createIbanOrder({
    event_id: eventId ?? null,
    user_id: user.id,
    total: Math.round(total),
    currency,
    metadata,
  });
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ order, reference, iban });
}
