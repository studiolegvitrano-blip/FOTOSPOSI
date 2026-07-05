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
    background_color: '#f8f6f3',
    theme_color: '#c4956a',
    lang: isIt ? 'it' : 'en',
    scope: '/',
    categories: ['wedding', 'events', 'photography', 'social'],
    icons: [
      { src: isIt ? '/favicon-sposi-192.png' : '/favicon-justmarry-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: isIt ? '/favicon-sposi-512.png' : '/favicon-justmarry-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: isIt ? '/favicon-sposi-512.png' : '/favicon-justmarry-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [],
  };
}
