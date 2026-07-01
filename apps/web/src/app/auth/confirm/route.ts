import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  if (tokenHash && type) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      },
    );

    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash: tokenHash,
    });

    if (!error && data?.user) {
      const { createClient } = await import('@supabase/supabase-js');
      const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await s.from('core_tenants').upsert({ id: data.user.id, brand: 'fotosposi', locale: 'it', name: 'Utente' }, { onConflict: 'id' });
      const { data: existing } = await s.from('core_users').select('id').eq('id', data.user.id).maybeSingle();
      if (!existing) {
        await s.from('core_users').insert({ id: data.user.id, email: data.user.email!, name: data.user.user_metadata?.name || 'Utente', role: 'sposo', tenant_id: data.user.id });
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL('/login?error=Verifica fallita', request.url));
}
