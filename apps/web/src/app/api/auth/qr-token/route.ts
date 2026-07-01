import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { eventId } = await req.json();
  if (!eventId) {
    return NextResponse.json({ error: 'eventId mancante' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const rawToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabase
    .from('core_auth_tokens')
    .insert({
      event_id: eventId,
      token: rawToken,
      role: 'invitato',
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ token: data });
}
