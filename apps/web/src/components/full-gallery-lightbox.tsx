'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MediaUpload } from '@fotosposi/media';

type Props = {
  media: MediaUpload[];
  initialUrl: string | null;
  onClose: () => void;
};

function mediaUrl(m: MediaUpload): string {
  return m.r2_key ? `/api/media/${m.id}/download` : m.url;
}

export default function FullGalleryLightbox({ media, initialUrl, onClose }: Props) {
  const photoMedia = media.filter((m) => (m.type || 'photo') === 'photo');
  const [index, setIndex] = useState<number>(-1);
  const touchStartX = useRef<number | null>(null);

  // Sync col initialUrl esterno
  useEffect(() => {
    if (initialUrl) {
      const found = photoMedia.findIndex((m) => mediaUrl(m) === initialUrl);
      setIndex(found >= 0 ? found : 0);
    } else {
      setIndex(-1);
    }
  }, [initialUrl, photoMedia.length]);

  const open = index >= 0 && index < photoMedia.length;

  const goPrev = useCallback(() => {
    setIndex((i) => (i <= 0 ? photoMedia.length - 1 : i - 1));
  }, [photoMedia.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i >= photoMedia.length - 1 ? 0 : i + 1));
  }, [photoMedia.length]);

  // Tastiera: ESC chiudi, frecce sx/dx naviga
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, goPrev, goNext]);

  // Body scroll lock quando aperto
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const dx = endX - touchStartX.current;
    if (dx > 50) goPrev();
    else if (dx < -50) goNext();
    touchStartX.current = null;
  };

  if (!open) return null;
  const current = photoMedia[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Pulsante chiudi */}
      <button
        type="button"
        className="absolute top-4 right-4 z-10 bg-white/10 text-white rounded-full p-2 hover:bg-white/20 transition-colors"
        aria-label="Chiudi"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Freccia sinistra */}
      {photoMedia.length > 1 && (
        <button
          type="button"
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 text-white rounded-full p-3 hover:bg-white/20 transition-colors"
          aria-label="Foto precedente"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      {/* Immagine centrale a schermo intero */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl(current)}
        alt=""
        className="max-w-full max-h-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Freccia destra */}
      {photoMedia.length > 1 && (
        <button
          type="button"
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 text-white rounded-full p-3 hover:bg-white/20 transition-colors"
          aria-label="Foto successiva"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Indicatore posizione */}
      {photoMedia.length > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-white/80 text-sm bg-black/40 rounded-full px-3 py-1">
          {index + 1} / {photoMedia.length}
        </p>
      )}
    </div>
  );
}
