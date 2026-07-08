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
  serverExternalPackages: ['sharp', 'ffmpeg-static'],
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
    // Il watermark video ora viene bruciato anche durante il proces