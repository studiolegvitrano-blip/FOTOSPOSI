import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { routing } from '../../i18n/routing';
import './globals.css';

export const metadata: Metadata = {
  title: 'FotoSposi',
  description: 'La piattaforma per il tuo matrimonio',
};

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
        " />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
