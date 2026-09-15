import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@fotosposi/core';
import { getPostBySlug, markdownToHtml } from '@fotosposi/seo';

export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sposi.live';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { post } = await getPostBySlug(supabase, slug, 'it');
  if (!post) return { title: 'Blog | Sposi.live' };
  return {
    title: `${post.title} | Sposi.live`,
    description: post.meta_description ?? undefined,
    alternates: { canonical: `${BASE}/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.meta_description ?? undefined,
      publishedTime: post.published_at ?? undefined,
      url: `${BASE}/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const supabase = createServiceClient();
  const { post } = await getPostBySlug(supabase, slug, 'it');
  if (!post) notFound();

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.meta_description ?? undefined,
    datePublished: post.published_at ?? post.created_at,
    dateModified: post.updated_at ?? post.created_at,
    inLanguage: post.locale,
    author: { '@type': 'Organization', name: 'Sposi.live', url: BASE },
    mainEntityOfPage: `${BASE}/blog/${post.slug}`,
  };

  return (
    <main className="min-h-screen bg-background text-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      <header className="border-b border-border bg-black">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/blog" className="font-semibold text-white">Blog · Sposi.live</Link>
          <Link href="/" className="text-sm text-white/80 hover:text-white">← Home</Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-sm text-text-muted">
          {post.published_at ? new Date(post.published_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">{post.title}</h1>
        <div className="mt-6" dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content_md) }} />
        <div className="mt-12 rounded-lg border border-border bg-surface p-5">
          <p className="font-semibold">Vuoi tutte le foto e i video dei tuoi invitati in un unico posto?</p>
          <p className="mt-1 text-sm text-text-muted">Con Sposi.live basta un QR code: gli invitati caricano, gli sposi rivivono tutto in galleria con la lista nozze inclusa.</p>
          <Link href="/" className="mt-3 inline-block text-sm font-medium text-brand underline underline-offset-2">Scopri Sposi.live →</Link>
        </div>
      </article>
    </main>
  );
}
