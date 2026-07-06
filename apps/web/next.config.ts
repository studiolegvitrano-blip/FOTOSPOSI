import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // sharp ships native bindings; letting webpack try to bundle it (via the
  // @fotosposi/photo-overlay workspace package) makes it go looking for
  // @img/sharp-libvips-dev/* files that don't exist in the Vercel build image.
  // Keeping it external forces Node's normal require() at runtime instead.
  serverExternalPackages: ['sharp'],
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
    'src/app/api/photos/[id]/share/route.ts': ['../../node_modules/ffmpeg-static/**'],
    // Il watermark video ora viene bruciato anche durante il processing della coda
    // (upload ospiti), nello sweep del cron e sui video guestbook: tutte queste
    // route spawnano ffmpeg.
    'src/app/api/r2/process-queue/route.ts': ['../../node_modules/ffmpeg-static/**'],
    'src/app/api/cron/maintenance/route.ts': ['../../node_modules/ffmpeg-static/**'],
    'src/app/api/guestbook/messages/route.ts': ['../../node_modules/ffmpeg-static/**'],
  },
};

export default withNextIntl(nextConfig);
