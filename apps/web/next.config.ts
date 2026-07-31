import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // sharp ships native bindings; letting webpack try to bundle it (via the
  // @fotosposi/photo-overlay workspace package) makes it go looking for
  // @img/sharp-libvips-dev/* files that don't exist in the Vercel build image.
  // Keeping it external forces Node's normal require() at runtime instead.
  // ffmpeg-static: se webpack lo inlinea, il path del binario viene calcolato dal
  // __dirname della route bundlata (.next/server/app/api/...) e spawn fallisce con
  // ENOENT ("spawn .../api/guestbook/messages/ffmpeg" — visto nei log Vercel).
  // Tenendolo esterno, require() risolve il vero node_modules/ffmpeg-static a runtime
  // (il binario arriva nella lambda grazie a outputFileTracingIncludes qui sotto).
  serverExternalPackages: [
    'sharp',
    'ffmpeg-static',
    // AWS SDK v3 + @smithy: lasciati esterni a webpack per evitare tree-shaking
    // errato del middleware stack di @aws-sdk/s3-request-presigner, che su
    // lambda Vercel falliva con "b is not a function" perché lo stack dei
    // middleware veniva clonato con prototype mancante (sessione 31/07/2026,
    // regression causa del 500 su /api/media/[id]/download e process-queue).
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    '@aws-sdk/signature-v4-multi-region',
    '@smithy/core',
    '@smithy/types',
    '@aws-sdk/types',
  ],
  transpilePackages: [
    '@fotosposi/core',
    '@fotosposi/events',
    '@fotosposi/media',
    '@fotosposi/games',
    '@fotosposi/social-sharing',
    '@fotosposi/commerce',
    '@fotosposi/site-builder',
    '@fotosposi/notifications',
    '@fotosposi/ui',
    '@fotosposi/video-overlay',
  ],
  // Make sure Vercel's function tracer bundles the ffmpeg-static binary (it's invoked via
  // child_process.spawn, which the tracer can't follow like a normal `require`).
  outputFileTracingIncludes: {
    // Oltre a ffmpeg e sharp (dichiarate come deps esplicite di apps/web), ogni route
    // che imprime watermark ha bisogno dei font e dei loghi:
    //   - assets/fonts/** + public/fonts/** — i TTF reali (sharp usa un fallback
    //     bundolato per le lettere latine ma senza font non ha glifo ❤ né i nomi
    //     scritti). Senza questi, su lambda Vercel niente testo nel watermark.
    //   - public/logo-*.png — i loghi brand da comporre top-right A COLORI.
    // sharp e ffmpeg-static sono dichiarati come deps esplicite in apps/web/package.json
    // (vedi FIX 29/07/2026), quindi Vercel li installa automaticamente e il tracer
    // di Next.js li include nel bundle lambda. NON serve più tracciarli esplicitamente.
    'src/app/api/photos/[id]/share/route.ts': ['assets/fonts/**', 'public/fonts/**', 'public/logo-*.png'],
    'src/app/api/r2/process-queue/route.ts': ['assets/fonts/**', 'public/fonts/**', 'public/logo-*.png'],
    'src/app/api/cron/maintenance/route.ts': ['assets/fonts/**', 'public/fonts/**', 'public/logo-*.png'],
    'src/app/api/guestbook/messages/route.ts': ['assets/fonts/**', 'public/fonts/**', 'public/logo-*.png'],
    // FIX 28/07/2026: route one-shot per riparare foto con watermark mancante
    // (vedi PROJECT_STATUS.md sessione 28/07). Stessi asset delle altre route.
    'src/app/api/r2/repair-watermark/route.ts': ['assets/fonts/**', 'public/fonts/**', 'public/logo-*.png'],
  },
};

export default withNextIntl(nextConfig);
