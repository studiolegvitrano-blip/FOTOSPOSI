import { NextRequest, NextResponse } from 'next/server';
import { listAffiliates, createAffiliate, getReferrals } from '@fotosposi/commerce';
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
    const { searchParams } = new URL(req.url);
    const referralsFor = searchParams.get('referrals');
    if (referralsFor) {
      const { referrals, error } = await getReferrals(referralsFor);
      if (error) return NextResponse.json({ error }, { status: 500 });
      return NextResponse.json({ referrals: referrals ?? [] });
    }
    const { affiliates, error } = await listAffiliates();
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data: affiliates ?? [], count: (affiliates ?? []).length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = ceoGate(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    if (!body.name || !body.email) {
      return NextResponse.json({ error: 'name e email richiesti' }, { status: 400 });
    }
    const { affiliate, error } = await createAffiliate({
      name: body.name,
      email: body.email,
      role: body.role || undefined,
      company: body.company || undefined,
      commission_rate: body.commission_rate !== undefined ? parseFloat(body.commission_rate) : 10,
      coupon_code: body.coupon_code || undefined,
    });
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ data: affiliate }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}
