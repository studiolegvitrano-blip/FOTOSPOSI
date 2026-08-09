import { NextResponse } from 'next/server';
import { CEO_COOKIE } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/ceo/logout — cancella il cookie di sessione CEO, redirect al login. */
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL('/ceo/login', request.url), 303);
  res.cookies.set(CEO_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
