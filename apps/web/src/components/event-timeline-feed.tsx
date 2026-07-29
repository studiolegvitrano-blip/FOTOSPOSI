'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import FacebookFeed, { type FeedPost } from './facebook-feed';
import type { MediaUpload } from '@fotosposi/media';
import type { WeddingEvent } from '@fotosposi/events';

type VideoMessage = MediaUpload & { from_name?: string };

type Props = {
  media: MediaUpload[];
  videos: VideoMessage[];
  event: WeddingEvent;
  eventId: string;
  onShareMedia: (id: string, isVideo: boolean) => void;
  onOpenImage?: (url: string) => void;
};

const PAGE_SIZE = 4;

export default function EventTimelineFeed({ media, videos, event, eventId, onShareMedia, onOpenImage }: Props) {
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
      .map((m) => ({
        id: m.id,
        author: authorFallback,
        timestamp: m.created_at || new Date().toISOString(),
        caption: undefined,
        imageUrl: m.r2_key ? `/api/media/${m.id}/download` : m.url,
        likes: 0,
        comments: [],
        backupPending: isBackupPending(m),
      }));
    const videoPosts: FeedPost[] = [...media.filter((m) => m.type === 'video'), ...videos].map((m) => {
      const id = m.id;
      const src = m.r2_key ? `/api/media/${id}/download` : (m as unknown as { url?: string }).url;
      const author = (m as unknown as { from_name?: string }).from_name || authorFallback;
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
  }, [media, videos, event.couple_name, c]);

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
      />
    </div>
  );
}
