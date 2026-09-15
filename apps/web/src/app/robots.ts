import type { MetadataRoute } from 'next';

// robots.txt (14/09/2026): permetti l'indicizzazione delle sole pagine pubbliche
// marketing/blog. Aree iscritte, eventi privati degli invitati e API restano fuori.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sposi.live';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/blog', '/faq', '/marketplace', '/partner', '/collaboratori', '/privacy'],
        disallow: ['/admin', '/ceo', '/api', '/dashboard', '/events', '/event', '/partner/dashboard'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
