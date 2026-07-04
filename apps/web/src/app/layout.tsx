import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { routing } from '../../i18n/routing';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get('host') || '';
  const isIt = host.includes('sposi.live') || !host.includes('justmarry.live');
  const brand = isIt ? 'Sposi.live' : 'JustMarry.live';
  const desc = isIt ? 'La piattaforma per il tuo matrimonio' : 'Your wedding platform';
  return {
    title: brand,
    description: desc,
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
      apple: '/icon-192.svg',
    },
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'default',
      'apple-mobile-web-app-title': brand,
      'application-name': brand,
    },
  };
}

async function getLocale(): Promise<string> {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value;
  if (locale && routing.locales.includes(locale as any)) return locale;
  return routing.defaultLocale;
}

async function loadMessages(locale: string) {
  try {
    return (await import(`../../messages/${locale}.json`)).default;
  } catch {
    return (await import(`../../messages/it.json`)).default;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await loadMessages(locale);

  return (
    <html lang={locale}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content="
          default-src 'self';
          img-src 'self' data: blob: https: http:;
          media-src 'self' blob: https:;
          frame-src 'self' https://www.instagram.com https://www.tiktok.com https://open.spotify.com https://www.facebook.com;
          style-src 'self' 'unsafe-inline';
          script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.instagram.com https://www.tiktok.com;
          connect-src 'self' https:;
          worker-src 'self' blob:;
        " />
        <meta name="theme-color" content="#d4a574" />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <script dangerouslySetInnerHTML={{ __html: "if('serviceWorker' in navigator)navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(r){r.unregister()})})" }} />
      </body>
    </html>
  );
}
