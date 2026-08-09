import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { routing } from '../i18n/routing';
import { ceoTokenFromCookies, verifyCeoSession } from './lib/ceo-auth';

function getLocale(request: NextRequest): string {
  const host = request.headers.get('host') || '';
  if (host.includes('sposi.live')) return 'it';
  if (host.includes('justmarry.live')) return 'en-US';

  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && routing.locales.includes(cookieLocale as any)) return cookieLocale;

  const acceptLang = request.headers.get('Accept-Language');
  if (acceptLang) {
    const preferred = acceptLang.split(',')[0]?.split('-')[0];
    if (preferred === 'en') return 'en-US';
    if (preferred === 'de') return 'de';
    if (preferred === 'fr') return 'fr';
  }

  return routing.defaultLocale;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as any),
          );
        },
      },
      // FIX 31/07/2026: PKCE flow esplicito + auto-refresh. Senza questo il refresh token
      // non veniva propagato ai cookie lato server → dopo la scadenza dell'access_token (1h)
      // l'utente risulta non-authenticato finché non fa refresh manuale → sintomo "devo rifare
      // login ogni tanto". getUser() invoca refresh autonomamente quando serve.
      flowType: 'pkce',
    },
  );

  const locale = getLocale(request);
  if (!request.cookies.has('NEXT_LOCALE') || request.cookies.get('NEXT_LOCALE')?.value !== locale) {
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  // /auth/callback è il redirect target di OAuth Google/Facebook/Apple: in quel momento i cookie
  // auth NON sono ancora stati scritti (lo scambio code→session è client-side e avviene nel
  // useEffect della pagina). Se il middleware includesse /auth/callback nel loop di getUser(),
  // leggerebbe `user = null` al primo render e reindirizzerebbe a /login → loop morto. Lo
  // escludiamo esplicitamente dal controllo.
  if (request.nextUrl.pathname === '/auth/callback') return response;

  // /admin/* richiede autenticazione CEO (cookie HMAC firmato con CEO_PASSWORD).
  // Pattern unico per `/ceo/*` e `/admin/*` — cambia solo la rotta login in fallback.
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const token = ceoTokenFromCookies(request.headers.get('cookie'));
    if (!(await verifyCeoSession(token))) {
      const loginUrl = new URL('/ceo/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const protectedPaths = ['/dashboard', '/events/new'];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!isProtected) return response;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Passa `redirect` al login così un utente non-loggato che tenta di accedere a /dashboard
    // puObject tornare a quella pagina dopo login (stesso pattern usato da invitati via QR).
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Escludi /auth/callback dal matcher (vedi commento sopra), oltre agli asset statici e API.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|_next/data|auth/callback|.*\\.(?:js|css|json|woff2?|png|jpg|svg|ico)$).*)'],
};
