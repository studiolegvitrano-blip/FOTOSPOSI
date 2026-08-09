import { NextRequest, NextResponse } from 'next/server';
import { CEO_COOKIE, ceoPasswordMatches, isCeoPasswordConfigured, signCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ceo/login
 * Body: { password }
 * Verifica la password CEO (env CEO_PASSWORD) e in caso di successo imposta un
 * cookie httpOnly firmato (12h). Se la password non è configurata o non rispetta
 * la policy di complessità → 503 con dettaglio, per evitare che la console sia
 * raggiungibile con una password debole.
 */
export async function POST(req: NextRequest) {
  const { configured, policyOk } = isCeoPasswordConfigured();
  if (!configured) {
    return NextResponse.json(
      { error: 'CEO_PASSWORD non configurata. Imposta la variabile di ambiente.' },
      { status: 503 },
    );
  }
  if (!policyOk) {
    return NextResponse.json(
      {
        error:
          'CEO_PASSWORD non rispetta la policy di sicurezza: deve avere almeno 8 caratteri, una maiuscola, una minuscola, un numero e un simbolo.',
      },
      { status: 503 },
    );
  }

  let body: { password?: string } = {};
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 });
  }

  const password = body.password ?? '';
  if (!ceoPasswordMatches(password)) {
    return NextResponse.json({ error: 'Password non corretta' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CEO_COOKIE, await signCeoSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 12 * 60 * 60,
  });
  return res;
}
