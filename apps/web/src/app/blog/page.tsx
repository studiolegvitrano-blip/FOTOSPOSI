import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@fotosposi/core';
import { listPublishedPosts } from '@fotosposi/seo';

// Blog SEO (sessione 14/09/2026): pagine pubbliche indicizzabili per le
// keyword long-tail del settore matrimoni. Contenuto da blog_posts (RLS
// pubblica sui soli published) generato via @fotosposi/seo (Groq, gratis).
export const revalidate = 3600;

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sposi.live';

export const metadata: Metadata = {
  title: 'Blog matrimoni: guide, idee e consigli per gli sposi | Sposi.live',
  description:
    'Guide pratiche per organizzare il matrimonio: foto degli invitati, lista nozze online, regali per gli sposi e idee per il ricevimento.',
  alternates: { canonical: `${BASE}/blog` },
  openGraph: { type: 'website', title: 'Blog Sposi.live', url: `${BASE}/blog` },
};

export default async function BlogPage() {
  const supabase = createServiceClient();
  const { posts } = await listPublishedPosts(supabase, { locale: 'it' });

  return (
    <main className="min-h-screen bg-background text-text">
      <header className="border-b border-border bg-black">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold text-white">Sposi.live</Link>
          <Link href="/" className="text-sm text-white/80 hover:text-white">← Home</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Blog matrimoni</h1>
        <p className="mt-3 text-text-muted">
          Guide pratiche per gli sposi: foto degli invitati, lista nozze, idee regalo e ricevimento.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10 text-text-muted">Nessun articolo pubblicato ancora — torna presto.</p>
        ) : (
          <ul className="mt-10 space-y-6">
            {posts.map((p) => (
              <li key={p.id} className="rounded-lg border border-border bg-surface p-5">
                <Link href={`/blog/${p.slug}`} className="block group">
                  <h2 className="text-xl font-semibold group-hover:text-brand transition-colors">{p.title}</h2>
                  {p.meta_description && <p className="mt-2 text-sm text-text-muted line-clamp-2">{p.meta_description}</p>}
                  <p className="mt-3 text-xs text-text-muted">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
                    {p.keyword ? ` · ${p.keyword}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
