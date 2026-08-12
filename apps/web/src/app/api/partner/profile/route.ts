import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@fotosposi/core';
import { cookies } from 'next/headers';

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { claimText, website, address, company, socialHandle, socialHashtag } = body;

  const cookieStore = await cookies();
  const supabase = createServerSideClient(() => cookieStore.getAll());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof claimText === 'string') fields.claim_text = claimText.trim() || null;
  if (typeof website === 'string') fields.website = website.trim() || null;
  if (typeof address === 'string') fields.address = address.trim() || null;
  if (typeof company === 'string') fields.company = company.trim() || null;
  if (typeof socialHandle === 'string') fields.social_handle = socialHandle.trim().slice(0, 60) || null;
  if (typeof socialHashtag === 'string') fields.social_hashtag = socialHashtag.trim().slice(0, 60) || null;

  const { data: partner, error } = await supabase
    .from('partners')
    .update(fields)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!partner) return NextResponse.json({ error: 'Profilo partner non trovato' }, { status: 404 });

  return NextResponse.json({ partner });
}
