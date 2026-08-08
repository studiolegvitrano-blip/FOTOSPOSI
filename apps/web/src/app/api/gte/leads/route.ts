import { NextRequest, NextResponse } from 'next/server';
import { getB2BLeads, updateLeadStatus } from '@fotosposi/gte';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gate CEO: dal commit 660700e (03/08/2026) /admin/* è protetto dal middleware
 * CEO (cookie HMAC), ma le API /api/gte/* storicamente erano auth-gated via
 * sposo Supabase. La pagina /admin/leads ora gira sotto Server Component CEO
 * → aggiungiamo anche qui il check per coerenza (auth uniforme).
 */
function ceoGate(req: NextRequest): NextResponse | null {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!verifyCeoSession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const blocked = ceoGate(request);
  if (blocked) return blocked;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const category = searchParams.get('category') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100');
  const result = await getB2BLeads({ status, category, limit });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.leads, count: result.leads?.length ?? 0 });
}

export async function PATCH(request: NextRequest) {
  const blocked = ceoGate(request);
  if (blocked) return blocked;
  const body = await request.json();
  if (!body.id || !body.status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }
  const result = await updateLeadStatus(body.id, body.status, body.notes);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.lead);
}
