import { NextResponse } from 'next/server';
import { CEO_COOKIE } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/ceo/logout — cancella il cookie di sessione CEO. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(CEO_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
