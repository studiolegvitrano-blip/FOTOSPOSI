import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@fotosposi/core';
import { generateSeoArticle, insertDraft } from '@fotosposi/seo';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// La generazione AI (Groq) puo' richiedere 30-60s per un articolo da 1000+ parole.
export const maxDuration = 120;

async function ceoGate(req: NextRequest): Promise<NextResponse | undefined> {
  const token = ceoTokenFromCookies(req.headers.get('cookie'));
  if (!(await verifyCeoSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return undefined;
}

/**
 * Genera una bozza di articolo SEO per una keyword (Groq gratis → fallback
 * NVIDIA/Gemini). Body: { keyword, locale?: 'it', publish?: boolean,
 * extraContext?: string }. Default: salva come BOZZA (publish=false): la
 * pubblicazione e' un atto editoriale separato (PATCH /api/admin/seo/publish).
 */
export async function POST(req: NextRequest) {
  const blocked = await ceoGate(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const keyword = String(body.keyword ?? '').trim();
  if (!keyword) return NextResponse.json({ error: 'keyword obbligatoria' }, { status: 400 });

  const { draft, error } = await generateSeoArticle(keyword, {
    locale: body.locale,
    extraContext: body.extraContext,
  });
  if (!draft) return NextResponse.json({ error: error ?? 'generazione fallita' }, { status: 502 });

  const supabase = createServiceClient();
  const { post, error: dbErr } = await insertDraft(supabase, draft, {
    locale: body.locale ?? 'it',
    publish: body.publish === true,
  });
  if (dbErr) return NextResponse.json({ error: dbErr }, { status: 500 });

  return NextResponse.json({ post });
}
