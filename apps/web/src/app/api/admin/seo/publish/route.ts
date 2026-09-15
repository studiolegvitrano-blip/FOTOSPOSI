import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { publishPost } from '@fotosposi/seo';
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
 * Pubblica una bozza (status draft → published). Body: { id }.
 * La pubblicazione e' deliberatamente separata dalla generazione: l'output AI
 * va revisionato prima di diventare pubblico (qualita' SEO + reputazione brand).
 */
export async function POST(req: NextRequest) {
  const blocked = await ceoGate(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await publishPost(supabase, id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
