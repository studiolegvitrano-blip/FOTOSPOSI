import { NextRequest, NextResponse } from 'next/server';
import { listCoupons, createCoupon } from '@fotosposi/commerce';
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

export async function GET(req: NextRequest) {
  const blocked = ceoGate(req);
  if (blocked) return blocked;

  try {
    const { coupons, error } = await listCoupons();
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data: coupons ?? [], count: (coupons ?? []).length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = ceoGate(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    if (!body.code || !body.discount_value || !body.discount_type) {
      return NextResponse.json({ error: 'code, discount_type e discount_value richiesti' }, { status: 400 });
    }
    if (!['percentage', 'fixed'].includes(body.discount_type)) {
      return NextResponse.json({ error: 'discount_type non valido' }, { status: 400 });
    }
    const { coupon, error } = await createCoupon({
      code: body.code,
      discount_type: body.discount_type,
      discount_value: parseFloat(body.discount_value),
      max_uses: body.max_uses ? parseInt(body.max_uses) : undefined,
      expires_at: body.expires_at || undefined,
    });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data: coupon }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}
