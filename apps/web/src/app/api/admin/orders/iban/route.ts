import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { listPendingIbanOrders, updateOrderStatus } from '@fotosposi/commerce';
import { generatePartnerCodes } from '@fotosposi/partner';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ceoGate(req: NextRequest): Promise<NextResponse | undefined> {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!(await verifyCeoSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return undefined;
}

/**
 * Console admin: ordini in attesa di bonifico (payment_method='iban',
 * status='pending'). CEO-gated come tutte le route /api/admin/*.
 */
export async function GET(req: NextRequest) {
  const blocked = await ceoGate(req);
  if (blocked) return blocked;

  const { orders, error } = await listPendingIbanOrders();
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ orders: orders ?? [] });
}

/**
 * Conferma il bonifico ricevuto: status pending → paid.
 * Se l'ordine è un pacchetto partner (metadata.kind='partner_package'),
 * genera i codici licenza come side-effect (l'acquisto è ora pagato).
 * Body: { orderId, action: 'confirm' | 'cancel' }
 */
export async function PATCH(req: NextRequest) {
  const blocked = await ceoGate(req);
  if (blocked) return blocked;

  const body = await req.json();
  const { orderId, action } = body;
  if (!orderId || !['confirm', 'cancel'].includes(action)) {
    return NextResponse.json({ error: 'orderId e action (confirm|cancel) obbligatori' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('payment_method', 'iban')
    .eq('status', 'pending')
    .maybeSingle();
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Ordine non trovato o già processato' }, { status: 404 });

  if (action === 'cancel') {
    await updateOrderStatus(orderId, 'cancelled');
    return NextResponse.json({ ok: true });
  }

  // Confirm: paid.
  const { error: upErr } = await updateOrderStatus(orderId, 'paid');
  if (upErr) return NextResponse.json({ error: upErr }, { status: 500 });

  // Side-effect: pacchetto partner pagato → genera i codici per il partner.
  const meta = (order.metadata ?? {}) as { kind?: string; tier?: string; quantity?: number };
  if (meta.kind === 'partner_package' && meta.tier && meta.quantity) {
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('user_id', order.user_id)
      .maybeSingle();
    if (partner) {
      const { codes, error: genErr } = await generatePartnerCodes(partner.id as string, meta.quantity, meta.quantity);
      if (genErr) {
        console.error('[admin/orders/iban] generazione codici fallita:', genErr);
        return NextResponse.json({ ok: true, warning: `Ordine pagato ma codici non generati: ${genErr}` });
      }
      return NextResponse.json({ ok: true, generatedCodes: (codes ?? []).length });
    }
  }

  return NextResponse.json({ ok: true });
}
