import type { ArticleDraft, BlogPost } from './types';

/**
 * CRUD del blog SEO. Il client Supabase e' passato dal chiamante (service role
 * per scritture, anon per letture pubbliche — la RLS espone SOLO published).
 * Interfaccia minimale strutturale per non imporre il tipo client esatto.
 */
type SupabaseLike = { from: (table: string) => any };

export async function listPublishedPosts(
  supabase: SupabaseLike,
  opts: { locale?: string; limit?: number } = {},
): Promise<{ posts: BlogPost[]; error?: string }> {
  const { locale = 'it', limit = 50 } = opts;
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, slug, locale, title, meta_description, keyword, published_at, created_at')
    .eq('status', 'published')
    .eq('locale', locale)
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) return { posts: [], error: error.message };
  return { posts: (data ?? []) as BlogPost[] };
}

export async function getPostBySlug(
  supabase: SupabaseLike,
  slug: string,
  locale = 'it',
): Promise<{ post: BlogPost | null; error?: string }> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('locale', locale)
    .eq('status', 'published')
    .maybeSingle();
  if (error) return { post: null, error: error.message };
  return { post: (data as BlogPost | null) ?? null };
}

export async function insertDraft(
  supabase: SupabaseLike,
  draft: ArticleDraft,
  opts: { locale?: string; publish?: boolean } = {},
): Promise<{ post?: BlogPost; error?: string }> {
  const row = {
    slug: draft.slug,
    locale: opts.locale ?? 'it',
    title: draft.title,
    meta_description: draft.meta_description || null,
    keyword: draft.keyword,
    content_md: draft.content_md,
    status: opts.publish ? 'published' : 'draft',
    published_at: opts.publish ? new Date().toISOString() : null,
  };
  // upsert su (locale, slug): re-generare la stessa keyword aggiorna la bozza
  const { data, error } = await supabase.from('blog_posts').upsert(row, { onConflict: 'locale,slug' }).select().maybeSingle();
  if (error) return { error: error.message };
  return { post: data as BlogPost };
}

export async function publishPost(supabase: SupabaseLike, id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message };
}
