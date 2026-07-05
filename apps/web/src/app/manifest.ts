import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  const host = h.get('host') || '';
  const isIt = host.includes('sposi.live') || !host.includes('justmarry.live');
  const brand = isIt ? 'Sposi.live' : 'JustMarry.live';
  const desc = isIt
    ? 'Gestisci foto, video, giochi e ricordi del tuo matrimonio'
    : 'Manage photos, videos, games and memories of your wedding';

  return {
    name: `${brand} — ${isIt ? 'La piattaforma per il tuo matrimonio' : 'Your wedding platform'}`,
    short_name: brand,
    description: desc,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#faf6f1',
    theme_color: '#d4a574',
    lang: isIt ? 'it' : 'en',
    scope: '/',
    categories: ['wedding', 'events', 'photography', 'social'],
    icons: [
      { src: '/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    screenshots: [],
  };
}
