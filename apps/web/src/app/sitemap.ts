import type { MetadataRoute } from 'next';
import { createServiceClient } from '@fotosposi/core';
import { listPublishedPosts } from '@fotosposi/seo';

// Sitemap pubblica (14/09/2026): pagine marketing + articoli blog indicizzabili.
// Le pagine degli eventi e le aree autenticate restano fuori (privacy invitati).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sposi.live';
  const staticUrls: MetadataRoute.Sitemap = ['', '/blog', '/faq', '/marketplace', '/partner', '/collaboratori', '/privacy'].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: 'weekly',
    priority: p === '' ? 1.0 : 0.7,
  }));

  const supabase = createServiceClient();
  const { posts } = await listPublishedPosts(supabase, { locale: 'it', limit: 200 });
  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/blog/${p.slug}`,
    lastModified: p.published_at ?? p.created_at,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticUrls, ...postUrls];
}
