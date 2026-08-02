import { NextRequest, NextResponse } from 'next/server';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/ceo/check — usato dalla UI per sapere se la sessione CEO è attiva. */
export async function GET(req: NextRequest) {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  const ok = verifyCeoSession(token);
  if (!ok) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true });
}
