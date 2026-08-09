import { NextRequest, NextResponse } from 'next/server';
import { getAllSuppliers, getAvgRating, approveSupplier, deleteSupplier } from '@fotosposi/marketplace';
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
 * GET /api/admin/marketplace
 *
 * Lista fornitori + rating aggregato. Service role (già nelle funzioni
 * @fotosposi/marketplace). Auth: cookie CEO.
 */
export async function GET(req: NextRequest) {
  const blocked = ceoGate(req);
  if (blocked) return blocked;

  try {
    const { suppliers, error } = await getAllSuppliers();
    if (error) return NextResponse.json({ error }, { status: 500 });

    const withRatings = await Promise.all(
      (suppliers ?? []).map(async (s) => {
        const r = await getAvgRating(s.id);
        return { ...s, avgRating: r.avg, reviewCount: r.count };
      }),
    );
    return NextResponse.json({ data: withRatings, count: withRatings.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/marketplace
 * Body: { id, approved: boolean }
 */
export async function PATCH(req: NextRequest) {
  const blocked = ceoGate(req);
  if (blocked) return blocked;

  try {
    const body = await req.json();
    if (!body.id || typeof body.approved !== 'boolean') {
      return NextResponse.json({ error: 'id e approved richiesti' }, { status: 400 });
    }
    const { error } = await approveSupplier(body.id, body.approved);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/marketplace?id=...
 */
export async function DELETE(req: NextRequest) {
  const blocked = ceoGate(req);
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });
    const { error } = await deleteSupplier(id);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Errore interno' }, { status: 500 });
  }
}
