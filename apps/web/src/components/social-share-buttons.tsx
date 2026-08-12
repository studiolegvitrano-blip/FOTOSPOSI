'use client';

import { useState } from 'react';
import {
  buildShareText,
  buildShareTextForInstagram,
  buildShareUrl,
  type SharePlatform,
  type BrandHandle,
} from '@fotosposi/social-sharing';

export type SocialShareProps = {
  /** URL pubblico assoluto della foto watermarked da condividere. */
  photoUrl: string;
  /** Handle sposo 1 (es. 'lillo' o '@lillo'). */
  groom1Handle?: string | null;
  /** Handle sposo 2. */
  groom2Handle?: string | null;
  /** Hashtag coppia (es. 'matri2026' o '#matri2026'). */
  coupleHashtag?: string | null;
  /** Handle partner B2B (evento white label). */
  partnerHandle?: string | null;
  /** Hashtag partner B2B. */
  partnerHashtag?: string | null;
  /** Brand: 'sposilive' (IT) o 'justmarry' (INT). Determina @brand hardcoded. */
  brand?: BrandHandle;
  /** Testo libero scritto dall'utente (prima riga). Default vuoto. */
  userText?: string;
  /** Position del pannello: 'inline' (nel footer card) o 'overlay' (sopra immagine). */
  variant?: 'inline' | 'overlay';
  /** Mostra il label testuale accanto alle icone. Default false (solo icone). */
  showLabels?: boolean;
};

type PlatformKey = SharePlatform | 'whatsapp';

const PLATFORM_META: Record<PlatformKey, { label: string; color: string }> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  twitter: { label: 'X', color: '#000000' },
  whatsapp: { label: 'WhatsApp', color: '#25D366' },
  tiktok: { label: 'TikTok', color: '#000000' },
};

/**
 * Costruisce URL share per WhatsApp. API gratuita: wa.me con testo precompilato.
 * Funziona su mobile (apre l'app) e desktop (WhatsApp Web).
 */
function buildWhatsappUrl(photoUrl: string, input: {
  userText?: string;
  groom1Handle?: string | null;
  groom2Handle?: string | null;
  coupleHashtag?: string | null;
  partnerHandle?: string | null;
  partnerHashtag?: string | null;
  brand?: BrandHandle;
}): string {
  const text = buildShareText({
    userText: input.userText ?? '',
    groom1Handle: input.groom1Handle,
    groom2Handle: input.groom2Handle,
    coupleHashtag: input.coupleHashtag,
    partnerHandle: input.partnerHandle,
    partnerHashtag: input.partnerHashtag,
    photoUrl,
    brand: input.brand ?? 'sposilive',
  });
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${photoUrl}`)}`;
}

export default function SocialShareButtons({
  photoUrl,
  groom1Handle,
  groom2Handle,
  coupleHashtag,
  partnerHandle,
  partnerHashtag,
  brand = 'sposilive',
  userText = '',
  variant = 'inline',
  showLabels = false,
}: SocialShareProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [showUserTextInput, setShowUserTextInput] = useState(false);
  const [userTextInput, setUserTextInput] = useState(userText);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleShare = async (platform: PlatformKey) => {
    const baseInput = {
      userText: userTextInput,
      groom1Handle,
      groom2Handle,
      coupleHashtag,
      partnerHandle,
      partnerHashtag,
      photoUrl,
      brand,
    };

    if (platform === 'instagram') {
      // IG non supporta URL share con testo precompilato → copia negli appunti.
      const text = buildShareTextForInstagram(baseInput);
      try {
        await navigator.clipboard.writeText(`${text}\n${photoUrl}`);
        showToast('Testo copiato — apri Instagram e incolla');
      } catch {
        showToast('Copia manuale: seleziona il testo e copia');
      }
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      return;
    }

    if (platform === 'whatsapp') {
      const url = buildWhatsappUrl(photoUrl, baseInput);
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    // Facebook / Twitter-X / TikTok: URL share con testo precompilato.
    const url = buildShareUrl(platform, baseInput);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Web Share API nativa (mobile). fallback ai pulsanti se non supportata.
  const handleNativeShare = async () => {
    if (typeof navigator === 'undefined' || !navigator.share) return false;
    const text = buildShareText({
      userText: userTextInput,
      groom1Handle,
      groom2Handle,
      coupleHashtag,
      partnerHandle,
      partnerHashtag,
      photoUrl,
      brand,
    });
    try {
      await navigator.share({
        title: 'Sposi.live',
        text,
        url: photoUrl,
      });
      return true;
    } catch {
      // utente ha annullato — silente
      return false;
    }
  };

  const platforms: PlatformKey[] = ['facebook', 'instagram', 'twitter', 'whatsapp', 'tiktok'];
  const supportsNativeShare = typeof navigator !== 'undefined' && !!navigator.share;
  const baseClass =
    variant === 'overlay'
      ? 'inline-flex items-center gap-1 bg-white/90 text-gray-800 rounded-full p-1.5 shadow-md hover:bg-white hover:scale-105 transition-all'
      : 'inline-flex items-center gap-1 p-1.5 rounded-md hover:bg-muted text-text-muted hover:text-text transition-colors';

  return (
    <div className={`relative ${variant === 'overlay' ? 'flex gap-1' : 'inline-flex items-center gap-1'}`}>
      {/* Tastonativa share (mobile) — solo se supportato e variante overlay */}
      {supportsNativeShare && variant === 'overlay' && (
        <button
          type="button"
          onClick={handleNativeShare}
          className={baseClass}
          aria-label="Condividi"
          title="Condividi (native)"
        >
          <ShareIcon className="w-4 h-4" />
        </button>
      )}

      {/* 4 tasti piccoli: FB / IG / X / WhatsApp */}
      {platforms.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => handleShare(p)}
          className={baseClass}
          aria-label={`Condividi su ${PLATFORM_META[p].label}`}
          title={PLATFORM_META[p].label}
          style={variant === 'overlay' ? { color: PLATFORM_META[p].color } : undefined}
        >
          <PlatformIcon platform={p} className="w-4 h-4" />
          {showLabels && <span className="text-xs">{PLATFORM_META[p].label}</span>}
        </button>
      ))}

      {/* Toggle input testo libero */}
      <button
        type="button"
        onClick={() => setShowUserTextInput((v) => !v)}
        className={baseClass}
        aria-label="Aggiungi testo"
        title="Aggiungi testo personale (opzionale)"
      >
        <PenIcon className="w-4 h-4" />
      </button>

      {/* Input testo libero — compare se toggle attivo */}
      {showUserTextInput && (
        <div className="absolute bottom-full mb-2 left-0 right-0 sm:right-auto sm:w-72 bg-white dark:bg-zinc-900 rounded-md shadow-lg border border-border p-2 z-20">
          <textarea
            value={userTextInput}
            onChange={(e) => setUserTextInput(e.target.value)}
            placeholder="Aggiungi una frase personale (opzionale)..."
            className="w-full text-sm bg-transparent resize-none focus:outline-none text-text placeholder:text-text-muted"
            rows={2}
            maxLength={140}
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] text-text-muted">{userTextInput.length}/140</span>
            <button
              type="button"
              onClick={() => setShowUserTextInput(false)}
              className="text-xs text-brand hover:underline"
            >
              Fatto
            </button>
          </div>
        </div>
      )}

      {/* Toast feedback (IG copy) */}
      {toast && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black/85 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

/* Icone SVG inline (no dep) */

function PlatformIcon({ platform, className }: { platform: PlatformKey; className?: string }) {
  switch (platform) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6v1.9h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.3 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .3-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.3-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.3 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.8.1-.9 0-1.4.2-1.7.3-.4.2-.7.4-1 .7-.3.3-.5.6-.7 1-.1.3-.3.8-.3 1.7-.1 1.3-.1 1.7-.1 4.8s0 3.5.1 4.8c0 .9.2 1.4.3 1.7.2.4.4.7.7 1 .3.3.6.5 1 .7.3.1.8.3 1.7.3 1.3.1 1.7.1 4.8.1s3.5 0 4.8-.1c.9 0 1.4-.2 1.7-.3.4-.2.7-.4 1-.7.3-.3.5-.6.7-1 .1-.3.3-.8.3-1.7.1-1.3.1-1.7.1-4.8s0-3.5-.1-4.8c0-.9-.2-1.4-.3-1.7-.2-.4-.4-.7-.7-1-.3-.3-.6-.5-1-.7-.3-.1-.8-.3-1.7-.3-1.3-.1-1.7-.1-4.8-.1Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 8.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm6.3-8.3a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z" />
        </svg>
      );
    case 'twitter':
      // X (ex Twitter) — logo X nativo
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M18.9 2.5h3.3l-7.2 8.3 8.5 11.2h-6.7l-5.2-6.9-6 6.9H2.3l7.7-8.8L2 2.5h6.9l4.7 6.3 5.3-6.3Zm-1.2 17.5h1.8L7.3 4.3H5.4l12.3 15.7Z" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.07 1.6 5.82L2 22l4.4-1.7a9.9 9.9 0 0 0 5.64 1.75c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.13c-1.83 0-3.6-.5-5.13-1.43l-.37-.22-2.6 1 .99-2.54-.24-.38a8.22 8.22 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 4.54 0 8.23 3.7 8.23 8.24 0 4.54-3.7 8.23-8.23 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.16-.29.18-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.38-1.73-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.16-.25.25-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.42l-.48-.01c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.39 1.02 2.55.12.16 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.51.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.11-.22-.17-.47-.29Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M16.6 5.82a4.28 4.28 0 0 1-1.06-2.32V3h-3.1v12.36a2.6 2.6 0 0 1-2.6 2.42 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 2.6-2.6c.27 0 .53.04.78.12V9.5a5.7 5.7 0 0 0-.78-.05 5.7 5.7 0 0 0-5.7 5.7 5.7 5.7 0 0 0 5.7 5.7 5.7 5.7 0 0 0 5.7-5.7V9.1a7.3 7.3 0 0 0 4.3 1.4V7.4a4.28 4.28 0 0 1-2.54-1.58Z" />
        </svg>
      );
  }
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function PenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
