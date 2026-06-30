'use client';

import { useState } from 'react';
import { shareMedia, defaultWatermark, applyWatermark, shareMediaWithFile } from '@fotosposi/social-sharing';

interface ShareButtonProps {
  imageUrl?: string;
  eventUrl: string;
  title: string;
  brand?: 'fotosposi' | 'weddingmoments';
}

export function ShareButton({ imageUrl, eventUrl, title, brand = 'fotosposi' }: ShareButtonProps) {
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const shared = await shareMedia(eventUrl, title);
      if (!shared) {
        await navigator.clipboard.writeText(eventUrl);
        alert('Link copiato negli appunti!');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleShareImage = async () => {
    if (!imageUrl) return;
    setSharing(true);
    try {
      const config = defaultWatermark(brand);
      const watermarked = await applyWatermark(imageUrl, config);
      const shared = await shareMediaWithFile(watermarked, title);
      if (!shared) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(watermarked);
        a.download = 'fotosposi.jpg';
        a.click();
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button onClick={handleShare} disabled={sharing}
        style={{ padding: '0.4rem 1rem', background: '#d4a574', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
        {sharing ? '...' : 'Condividi'}
      </button>
      {imageUrl && (
        <button onClick={handleShareImage} disabled={sharing}
          style={{ padding: '0.4rem 1rem', border: '1px solid #d4a574', color: '#d4a574', background: 'transparent', borderRadius: 4, cursor: 'pointer' }}>
          {sharing ? '...' : 'Scarica con watermark'}
        </button>
      )}
    </div>
  );
}
