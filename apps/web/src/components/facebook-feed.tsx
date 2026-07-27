'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Share2, MessageCircle, ThumbsUp, X } from 'lucide-react';
import ReactionsBar, { type ReactionType } from './reactions-bar';

export type FeedPost = {
  id: string;
  author: string;
  avatarUrl?: string;
  timestamp: string;            // ISO
  caption?: string;
  imageUrl?: string;
  videoUrl?: string;
  likes: number;
  comments: { author: string; text: string }[];
  reaction?: ReactionType;
};

type Props = {
  posts: FeedPost[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  onShare?: (p: FeedPost) => void;
  /** Callback quando l'utente clicca sulla foto di un post — apre il lightbox fullscreen. */
  onOpenImage?: (post: FeedPost) => void;
  containerClassName?: string;
  /** event_id per persistere reazioni/commenti nel DB (vedi /api/feed/{reactions,comments}). */
  eventId?: string;
};

/* Avatar con iniziali se manca la foto profilo */
function Avatar({ name, url, size = 40 }: { name: string; url?: string; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="fb-avatar" style={{ width: size, height: size }} />;
  }
  const initials = name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return (
    <span className="fb-avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initials}
    </span>
  );
}

/* Timestamp relativo: "adesso", "5 minuti fa", "2 ore fa", "3 giorni fa" */
function relativeTime(iso: string, t: (k: string, vars?: Record<string, number>) => string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t('adesso');
  if (m < 60) return t('minuti_fa', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('ore_fa', { count: h });
  const d = Math.floor(h / 24);
  return t('giorni_fa', { count: d });
}

const REACTION_EMOJI: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  adore: '😍',
  wow: '😮',
  sigh: '😢',
  grrr: '😡',
};

export default function FacebookFeed({
  posts,
  loading = false,
  onLoadMore,
  hasMore = false,
  onShare,
  onOpenImage,
  containerClassName = '',
  eventId,
}: Props & { eventId?: string }) {
  const t = useTranslations('feed');
  const [commentsOpen, setCommentsOpen] = useState<Set<string>>(new Set());
  const [postReactions, setPostReactions] = useState<Record<string, ReactionType | undefined>>({});
  const [reactionCounts, setReactionCounts] = useState<Record<string, Partial<Record<ReactionType, number>>>>({});
  const [popPostId, setPopPostId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [extraComments, setExtraComments] = useState<Record<string, { id?: string; author: string; text: string; created_at?: string }[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Set<string>>(new Set());

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '400px' }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [onLoadMore, hasMore]);

  // Carica le reazioni dal DB per tutti i media dei post visibili (persistenza).
  useEffect(() => {
    if (!eventId || posts.length === 0) return;
    const ids = posts.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    fetch(`/api/feed/reactions?event_id=${eventId}&media_ids=${ids.join(',')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const counts: Record<string, Partial<Record<ReactionType, number>>> = {};
        const mine: Record<string, ReactionType> = {};
        for (const id of ids) {
          const entry = data[id];
          if (entry?.counts) counts[id] = entry.counts;
          if (entry?.myReaction) mine[id] = entry.myReaction;
        }
        setReactionCounts(counts);
        setPostReactions((s) => ({ ...s, ...mine }));
      })
      .catch(() => {/* silente: meglio UI senza reaction counter che error toast */});
    return () => { cancelled = true; };
  }, [eventId, posts.map((p) => p.id).join(',')]);

  const toggleComments = useCallback((id: string) => {
    setCommentsOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Lazy-load: prima volta che si apre → scarica i commenti dal DB.
        if (eventId && !extraComments[id]) {
          setCommentsLoading((c) => new Set(c).add(id));
          fetch(`/api/feed/comments?event_id=${eventId}&media_id=${id}`)
            .then((r) => (r.ok ? r.json() : { comments: [] }))
            .then((data) => {
              setExtraComments((s) => ({ ...s, [id]: data.comments ?? [] }));
            })
            .catch(() => {/* silente */})
            .finally(() => setCommentsLoading((c) => { const n = new Set(c); n.delete(id); return n; }));
        }
      }
      return next;
    });
  }, [eventId, extraComments]);

  const handleReact = async (post: FeedPost, r: ReactionType) => {
    const id = post.id;
    const prev = postReactions[id];
    const isToggleOff = prev === r;

    // Ottimistic: aggiorna subito UI
    setPostReactions((s) => ({ ...s, [id]: isToggleOff ? undefined : r }));
    setReactionCounts((s) => {
      const counts = { ...(s[id] ?? {}) } as Partial<Record<ReactionType, number>>;
      if (prev) counts[prev] = Math.max(0, (counts[prev] || 1) - 1);
      if (!isToggleOff) counts[r] = (counts[r] || 0) + 1;
      return { ...s, [id]: counts };
    });
    setPopPostId(id);
    setTimeout(() => setPopPostId(null), 360);

    // Persisti nel DB. Senza eventId → niente persistenza (fallback al vecchio comportamento).
    if (!eventId) return;
    try {
      await fetch('/api/feed/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          media_id: id,
          reaction: isToggleOff ? null : r,
        }),
      });
    } catch {
      // silente: UI ha già l'aggiornamento ottimistico; errore di rete non blocca
    }
  };

  const submitComment = async (id: string) => {
    const text = (commentDraft[id] || '').trim();
    if (!text) return;
    if (!eventId) {
      // fallback locale se eventId non passato
      setExtraComments((s) => ({
        ...s,
        [id]: [...(s[id] || []), { author: 'Tu', text }],
      }));
      setCommentDraft((s) => ({ ...s, [id]: '' }));
      return;
    }
    try {
      const res = await fetch('/api/feed/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, media_id: id, text }),
      });
      const data = await res.json();
      if (res.ok && data?.comment) {
        setExtraComments((s) => ({
          ...s,
          [id]: [...(s[id] || []), data.comment],
        }));
      }
    } catch {
      // silente
    }
    setCommentDraft((s) => ({ ...s, [id]: '' }));
  };

  return (
    <div className={`space-y-4 ${containerClassName}`}>
      {posts.map((p) => {
        const counts = reactionCounts[p.id] ?? {};
        const likes = Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0) || p.likes;
        const reaction = postReactions[p.id];
        const comments = [...p.comments, ...(extraComments[p.id] || [])];
        return (
          <article key={p.id} className="fb-card overflow-hidden">
            {/* Header: avatar + nome + timestamp */}
            <div className="flex items-center gap-3 px-4 pt-3">
              <Avatar name={p.author} url={p.avatarUrl} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text leading-tight">{p.author}</p>
                <p className="text-xs text-text-muted">
                  {relativeTime(p.timestamp, t)}
                </p>
              </div>
            </div>

            {/* Didascalia */}
            {p.caption && (
              <p className="px-4 pt-2 pb-3 text-[15px] text-text whitespace-pre-line leading-relaxed">
                {p.caption}
              </p>
            )}

            {/* Media (foto o video) */}
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt={p.caption || ''}
                className="w-full object-cover bg-muted max-h-[680px] cursor-zoom-in"
                loading="lazy"
                onClick={() => onOpenImage?.(p)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenImage?.(p);
                  }
                }}
              />
            )}
            {p.videoUrl && (
              <video src={p.videoUrl} controls className="w-full object-cover bg-black max-h-[680px]" />
            )}

            {/* Contatore like + commenti */}
            <div className="flex items-center justify-between px-4 py-2.5 text-xs text-text-muted border-b border-border">
              <span className="flex items-center gap-1">
                {likes > 0 && (
                  <>
                    <span className="text-like">👍</span>
                    <span className={popPostId === p.id ? 'fb-pop' : ''}>
                      {likes}
                    </span>
                  </>
                )}
              </span>
              {comments.length > 0 && (
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => toggleComments(p.id)}
                >
                  {comments.length} {t('comments_count_label')}
                </button>
              )}
            </div>

            {/* Barra azioni */}
            <div className="flex items-center justify-around px-2 py-1 text-sm font-semibold text-text-muted">
              <div className="fb-like-btn relative flex-1">
                <button
                  type="button"
                  onClick={() => handleReact(p, reaction || 'like')}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-md hover:bg-muted ${
                    reaction ? 'text-like' : ''
                  }`}
                >
                  <span className="text-[18px] leading-none">{reaction ? REACTION_EMOJI[reaction] : <ThumbsUp size={18} />}</span>
                  <span>{reaction ? t(`reaction_${reaction}`) : t('mi_piaci')}</span>
                </button>
                <ReactionsBar onPick={(r) => handleReact(p, r)} />
              </div>
              <button
                type="button"
                onClick={() => toggleComments(p.id)}
                className="flex-1 w-full flex items-center justify-center gap-2 py-2 rounded-md hover:bg-muted"
              >
                <MessageCircle size={18} />
                <span>{t('commenta')}</span>
              </button>
              {onShare && (
                <button
                  type="button"
                  onClick={() => onShare(p)}
                  className="flex-1 w-full flex items-center justify-center gap-2 py-2 rounded-md hover:bg-muted"
                >
                  <Share2 size={18} />
                  <span>{t('condividi')}</span>
                </button>
              )}
            </div>

            {/* Sezione commenti collassabile */}
            {commentsOpen.has(p.id) && (
              <div className="px-4 pb-3 space-y-2 border-t border-border bg-surface">
                {comments.map((c, i) => (
                  <div key={i} className="flex gap-2 pt-2">
                    <Avatar name={c.author} size={32} />
                    <div className="bg-muted rounded-2xl px-3 py-2 max-w-full">
                      <p className="text-sm font-semibold">{c.author}</p>
                      <p className="text-sm text-text">{c.text}</p>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Avatar name="Tu" size={32} />
                  <div className="flex-1 flex items-center gap-1 bg-muted rounded-2xl px-3 py-1">
                    <input
                      type="text"
                      value={commentDraft[p.id] || ''}
                      onChange={(e) => setCommentDraft((s) => ({ ...s, [p.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitComment(p.id);
                      }}
                      placeholder={t('invia_commento')}
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                    />
                    {commentDraft[p.id]?.trim() && (
                      <button
                        type="button"
                        onClick={() => submitComment(p.id)}
                        className="text-brand font-semibold text-sm hover:underline"
                      >
                        {t('invia')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </article>
        );
      })}

      {/* Skeleton shimmer durante il caricamento */}
      {loading &&
        Array.from({ length: 2 }).map((_, i) => (
          <div key={`sk-${i}`} className="fb-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 pt-3">
              <div className="w-10 h-10 rounded-full fb-shimmer" />
              <div className="flex-1 space-y-1.5">
                <div className="w-32 h-3 rounded fb-shimmer" />
                <div className="w-20 h-2.5 rounded fb-shimmer" />
              </div>
            </div>
            <div className="mx-4 mt-3 mb-3 h-4 w-3/4 rounded fb-shimmer" />
            <div className="w-full aspect-[4/3] fb-shimmer" />
          </div>
        ))}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="fb-card p-8 text-center text-text-muted">
          <p>{t('niente_post')}</p>
        </div>
      )}

      {/* Sentinel per infinite scroll */}
      {hasMore && !loading && <div ref={sentinelRef} className="h-10" />}

      {/* Iconografo in fondo + reazione corrente / fallback */}
      {posts.some((p) => postReactions[p.id]) && (
        <p className="text-center text-xs text-text-muted pt-2">
          {t('persone_ammirano')}
        </p>
      )}
    </div>
  );
}

export { X };
