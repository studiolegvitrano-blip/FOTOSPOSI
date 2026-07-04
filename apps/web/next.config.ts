import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
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
  },
};

export default withNextIntl(nextConfig);
