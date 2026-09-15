/** Post del blog SEO pubblico (tabella blog_posts, migration 14/09/2026). */
export interface BlogPost {
  id: string;
  slug: string;
  locale: string;
  title: string;
  meta_description: string | null;
  keyword: string | null;
  content_md: string;
  status: 'draft' | 'published';
  published_at: string | null;
  event_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Bozza articolo generata dall'AI (prima dell'inserimento in DB). */
export interface ArticleDraft {
  title: string;
  slug: string;
  meta_description: string;
  keyword: string;
  content_md: string;
}
