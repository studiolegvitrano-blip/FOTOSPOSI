'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MediaUpload } from '@fotosposi/media';
import SocialShareButtons, { type SocialShareProps } from './social-share-buttons';

type Props = {
  media: MediaUpload[];
  initialUrl: string | null;
  onClose: () => void;
  /**
   * Props per share-with-tags (tag @sposi + @sposilive + #hashtag coppia + handle partner B2B).
   * Se presente, attiva il long-press sulla foto per aprire il menu custom a 5 icone
   * (FB/IG/X/WhatsApp/TikTok). Tap singolo = foto successiva (comportamento predefinito).
   * Su desktop idem: stessi 5 tasti in overlay (menu custom aperto).
   */
  shareProps?: Omit<SocialShareProps, 'photoUrl'>;
};

function mediaUrl(m: MediaUpload): string {
  return m.r2_key ? `/api/media/${m.id}/download` : m.url;
}

/**
 * Risolve URL media relativo in URL pubblico assoluto richiesto dai social sharer.
 * Su SSR window non esiste → fallback string vuota (i tasti share non renderizzati server side).
 */
function absoluteUrl(relativePath?: string): string {
  if (!relativePath) return '';
  if (relativePath.startsWith('http')) return relativePath;
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

/** Soglia long-press in millisecondi. Sotto questa soglia = tap (foto successiva). */
const LONG_PRESS_MS = 500;
/** Soglia movimento: se il dito si sposta > 10px durante il press è uno swipe, non un long-press. */
const MOVE_TOLERANCE_PX = 10;

export default function FullGalleryLightbox({ media, initialUrl, onClose, shareProps }: Props) {
  const photoMedia = media.filter((m) => (m.type || 'photo') === 'photo');
  const [index, setIndex] = useState<number>(-1);
  const touchStartX = useRef<number | null>(null);

  // Long-press state
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartPos = useRef<{ x: number; y: number } | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [sharePhotoUrl, setSharePhotoUrl] = useState<string>('');

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

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  // Chiudi menu share quando cambia foto o lightbox si chiude
  useEffect(() => {
    setShareMenuOpen(false);
    clearPressTimer();
  }, [index, open, clearPressTimer]);

  // Tastiera: ESC chiudi, frecce sx/dx naviga
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (shareMenuOpen) {
          setShareMenuOpen(false);
          return;
        }
        onClose();
      } else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, goPrev, goNext, shareMenuOpen]);

  // Body scroll lock quando aperto
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [open]);

  // Cleanup timer long-press quando si smonta
  useEffect(() => clearPressTimer, [clearPressTimer]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    // LONG PRESS su mobile: avvia timer. Spostamento > tolleranza annulla.
    if (shareProps && e.touches[0]) {
      pressStartPos.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      clearPressTimer();
      pressTimer.current = setTimeout(() => {
        // Long-press confermato → apri menu share
        if (current) {
          setSharePhotoUrl(absoluteUrl(mediaUrl(current)));
          setShareMenuOpen(true);
        }
      }, LONG_PRESS_MS);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Se il dito si sposta > MOVE_TOLERANCE_PX → è uno swipe, annulla long-press
    if (
      pressStartPos.current &&
      e.touches[0] &&
      (Math.abs(e.touches[0].clientX - pressStartPos.current.x) > MOVE_TOLERANCE_PX ||
        Math.abs(e.touches[0].clientY - pressStartPos.current.y) > MOVE_TOLERANCE_PX)
    ) {
      clearPressTimer();
      pressStartPos.current = null;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    clearPressTimer();
    pressStartPos.current = null;

    if (shareMenuOpen) return; // non navigare quando il menu è aperto
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const dx = endX - touchStartX.current;
    if (dx > 50) goPrev();
    else if (dx < -50) goNext();
    touchStartX.current = null;
  };

  // Long-press su desktop: mouse down + hold 500ms
  const onMouseDown = (e: React.MouseEvent) => {
    if (!shareProps || e.button !== 0) return;
    pressStartPos.current = { x: e.clientX, y: e.clientY };
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      if (current) {
        setSharePhotoUrl(absoluteUrl(mediaUrl(current)));
        setShareMenuOpen(true);
      }
    }, LONG_PRESS_MS);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!pressStartPos.current) return;
    if (
      Math.abs(e.clientX - pressStartPos.current.x) > MOVE_TOLERANCE_PX ||
      Math.abs(e.clientY - pressStartPos.current.y) > MOVE_TOLERANCE_PX
    ) {
      clearPressTimer();
      pressStartPos.current = null;
    }
  };

  const onMouseUp = () => {
    clearPressTimer();
    pressStartPos.current = null;
  };

  // Click singolo sulla foto = foto successiva (solo se menu share chiuso e non è stato un long-press)
  const onPhotoClick = () => {
    if (shareMenuOpen) return;
    if (photoMedia.length > 1) goNext();
  };

  if (!open) return null;
  const current = photoMedia[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pulsante chiudi */}
      <button
        type="button"
        className="absolute top-4 right-4 z-10 bg-white/10 text-white rounded-full p-2 hover:bg-white/20 transition-colors"
        aria-label="Chiudi"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
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
        onClick={onPhotoClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        role="button"
        aria-label="Tap per foto successiva, tieni premuto per condividere"
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

      {/* Indicatore posizione + hint long-press */}
      {photoMedia.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-center">
          <p className="text-white/80 text-sm bg-black/40 rounded-full px-3 py-1">
            {index + 1} / {photoMedia.length}
          </p>
          {shareProps && !shareMenuOpen && (
            <p className="text-white/50 text-xs mt-1 bg-black/40 rounded-full px-2 py-0.5">
              Tieni premuto per condividere
            </p>
          )}
        </div>
      )}

      {/* Menu custom share (long-press) — 5 icone social + testo libero + chiudi */}
      {shareMenuOpen && shareProps && (
        <div
          className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShareMenuOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl p-4 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-text">Condividi questa foto</p>
              <button
                type="button"
                onClick={() => setShareMenuOpen(false)}
                className="text-text-muted hover:text-text p-1 rounded-full hover:bg-muted"
                aria-label="Chiudi menu condivisione"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SocialShareButtons
              {...shareProps}
              photoUrl={sharePhotoUrl}
              variant="inline"
            />

            <p className="text-[11px] text-text-muted mt-3 leading-relaxed">
              Il testo con i tag (@sposi, @sposilive, #hashtag coppia
              {shareProps.partnerHandle ? ', @partner' : ''}) viene generato automaticamente.
              Su Instagram il testo viene copiato negli appunti: apri l'app e incolla.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
