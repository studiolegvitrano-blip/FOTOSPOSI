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
  ],
};

export default withNextIntl(nextConfig);
