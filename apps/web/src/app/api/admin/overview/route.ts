import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/overview
 *
 * Pagina /admin (pannello di gestione): elenco eventi recenti + utenti.
 * Protetta da sessione CEO (cookie HMAC), stesso pattern di /api/admin/system
 * e /api/ceo/overview. Usa il service role per bypassare RLS.
 */
export async function GET(req: NextRequest) {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!verifyCeoSession(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const svc = createServiceClient();

    const [{ data: events }, { data: users }] = await Promise.all([
      svc.from('events').select('id, couple_name, date, location, tier, brand, created_at').order('created_at', { ascending: false }).limit(50),
      svc.from('core_users').select('id, first_name, last_name, name, email, role, role_at_event, created_at').limit(50),
    ]);

    return NextResponse.json({
      events: events ?? [],
      users: users ?? [],
      counts: {
        events: events?.length ?? 0,
        users: users?.length ?? 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
