import { NextRequest, NextResponse } from 'next/server';
import { createServerSideClient } from '@fotosposi/core';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerSideClient(() => cookieStore.getAll());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
  }

  const { data: partner, error } = await supabase
    .from('partners')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!partner) {
    return NextResponse.json({ partner: null });
  }

  return NextResponse.json({ partner });
}
