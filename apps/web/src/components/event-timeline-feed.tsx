'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import FacebookFeed, { type FeedPost } from './facebook-feed';
import type { MediaUpload } from '@fotosposi/media';
import type { WeddingEvent } from '@fotosposi/events';
import { isGalleryVisibleRole } from '@/lib/guest-roles';

type VideoMessage = MediaUpload & { from_name?: string };

type Props = {
  media: MediaUpload[];
  videos: VideoMessage[];
  event: WeddingEvent;
  eventId: string;
  onShareMedia: (id: string, isVideo: boolean) => void;
  onOpenImage?: (url: string) => void;
  /**
   * true se l'utente corrente è sposo (creator) o delegato con edit/admin.
   * Passato al FacebookFeed per mostrare il bottone "Cancella" per ogni foto.
   */
  canManage?: boolean;
  /** Callback per cancellare un media. La pagina padre la connette a DELETE /api/media/[id]. */
  onDeleteMedia?: (postId: string) => Promise<void>;
  /**
   * Se true mostra il ruolo del caricatore sotto il nome (solo Testimone sposa/sposo,
   * Padre, Madre — vedi guest-roles.ts). Default true. Gli altri ruoli (Amico, Parente,
   * Collega, Altro) non vengono MAI mostrati, a prescindere da questo flag.
   */
  showUploaderRoles?: boolean;
  /**
   * Props per share-with-tags (tag @sposi + @sposilive + #hashtag coppia + handle partner B2B).
   * Se presente, mostra 4 tastini (FB/IG/X/WhatsApp) su ogni card galleria. Passato al FacebookFeed.
   */
  shareProps?: Omit<import('./social-share-buttons').SocialShareProps, 'photoUrl'>;
};

const PAGE_SIZE = 4;

export default function EventTimelineFeed({ media, videos, event, eventId, onShareMedia, onOpenImage, canManage, onDeleteMedia, showUploaderRoles = true, shareProps }: Props) {
  const t = useTranslations('feed');
  const c = useTranslations('common');
  const [page, setPage] = useState(1);

  // Costruisce i post feed unendo foto e video, ordinati per created_at desc.
  const posts: FeedPost[] = useMemo(() => {
    const authorFallback = event.couple_name || c('brand_name');
    // FIX 29/07/2026: propaga `backupPending` per mostrare il badge sotto la
    // foto quando Drive sync non è ancora andato a buon fine. Un media è
    // "in attesa di backup" quando drive_sync_status != 'synced' E esiste
    // un r2_key (= la foto è su R2, sicura per l'utente, ma Drive deve ancora
    // riceverla).
    const isBackupPending = (m: MediaUpload) =>
      !!m.r2_key && m.drive_sync_status !== 'synced';
    const photoPosts: FeedPost[] = media
      .filter((m) => (m.type || 'photo') === 'photo')
      .map((m) => {
        // FIX 31/07/2026: usa uploader_name + role_at_event come "author" del post, così
        // appare in fronte al post feed "Mario Rossi — Testimone". Se mancanti (pubblico non
        // autenticato), fallback a authorFallback = couple_name. Senza nome reale dell'uploader,
        // il post apparirebbe come caricato dagli sposi anche se è di un invitato.
        const uploaderName = (m as any).uploader_name as string | undefined;
        const role = (m as any).uploader_role_at_event as string | undefined;
        const visibleRole = showUploaderRoles && isGalleryVisibleRole(role) ? role : undefined;
        const author = uploaderName
          ? (visibleRole ? `${uploaderName} — ${visibleRole}` : uploaderName)
          : authorFallback;
        return {
          id: m.id,
          author,
          timestamp: m.created_at || new Date().toISOString(),
          caption: undefined,
          imageUrl: m.r2_key ? `/api/media/${m.id}/download` : m.url,
          likes: 0,
          comments: [],
          backupPending: isBackupPending(m),
        };
      });
    const videoPosts: FeedPost[] = [...media.filter((m) => m.type === 'video'), ...videos].map((m) => {
      const id = m.id;
      const src = m.r2_key ? `/api/media/${id}/download` : (m as unknown as { url?: string }).url;
      const baseAuthor = (m as unknown as { from_name?: string }).from_name
        || (m as any).uploader_name
        || authorFallback;
      const role = (m as any).uploader_role_at_event as string | undefined;
      const visibleRole = showUploaderRoles && isGalleryVisibleRole(role) ? role : undefined;
      const author = visibleRole ? `${baseAuthor} — ${visibleRole}` : baseAuthor;
      return {
        id,
        author,
        timestamp: m.created_at || new Date().toISOString(),
        caption: undefined,
        videoUrl: src,
        likes: 0,
        comments: [],
        backupPending: isBackupPending(m as MediaUpload),
      };
    });
    return [...photoPosts, ...videoPosts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [media, videos, event.couple_name, c, showUploaderRoles]);

  // Paginazione in-memory (richiede poche foto per testare l'infinite scroll)
  const visible = posts.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < posts.length;

  const onLoadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  // Quando nuovi media arrivano (timer refresh galleria), resetta la pagina
  useEffect(() => {
    setPage(1);
  }, [posts.length]);

  const handleShare = useCallback(
    (p: FeedPost) => {
      const isVideo = !!p.videoUrl;
      onShareMedia(p.id, isVideo);
    },
    [onShareMedia]
  );

  // Apertura lightbox — l'URL è quello che FullGalleryLightbox usa per trovare l'index.
  const handleOpenImage = useCallback(
    (p: FeedPost) => {
      if (!p.imageUrl) return;
      onOpenImage?.(p.imageUrl);
    },
    [onOpenImage]
  );

  return (
    <div className="max-w-xl mx-auto">
      <FacebookFeed
        posts={visible}
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        onShare={handleShare}
        onOpenImage={handleOpenImage}
        eventId={eventId}
        canManage={canManage}
        onDeleteMedia={onDeleteMedia}
        shareProps={shareProps}
      />
    </div>
  );
}
