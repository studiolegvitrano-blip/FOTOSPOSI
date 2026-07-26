'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Anteprima watermark "Watermark MAX" per la homepage.
 * Regole utente (sessione 25/07/2026):
 *  - Testo monogramma piccolo, UNA SOLA RIGA, in basso al centro.
 *  - Colore auto black/white in base alla luminanza della fascia bassa della foto.
 *  - Opacità 50%.
 *  - Logo Sposi.live A COLORI, top-right, 1/3 più grande di prima.
 */
export default function WatermarkMaxPreview() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [textColor, setTextColor] = useState<'white' | 'black'>('white');

  // Campiona la fascia bassa della foto per scegliere bianco/nero.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/hero-wedding.jpg';

    img.onload = () => {
      if (cancelled) return;
      try {
        const sampleH = Math.max(1, Math.floor(img.height * 0.18));
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = sampleH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(
          img,
          0, img.height - sampleH, img.width, sampleH,
          0, 0, img.width, sampleH,
        );
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (!data) return;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4 * 40) {
          r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++;
        }
        const avg = (r + g + b) / (3 * n);
        setTextColor(avg < 128 ? 'white' : 'black');
      } catch {
        setTextColor('white');
      }
    };
    img.onerror = () => { if (!cancelled) setTextColor('white'); };

    return () => { cancelled = true; };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] rounded-xl overflow-hidden shadow-md border border-border"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: 'url(/hero-wedding.jpg)' }}
      />

      {/* Watermark monogramma — una sola istanza, in basso a sinistra.
          Font ~12px ( clamp ≥7px ≤12px ). Opacità 50%. Colore auto. Cuore sempre rosso. */}
      <div className="absolute inset-x-0 bottom-0 left-0 p-3 pointer-events-none">
        <p
          className="whitespace-nowrap"
          style={{
            fontFamily: "'Lucida Calligraphy', 'Apple Chancery', 'Snell Roundhand', cursive",
            fontSize: 'clamp(7px, 3.4vw, 12px)',
            letterSpacing: '0.02em',
            color: textColor,
            opacity: 0.5,
            filter: textColor === 'white'
              ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))'
              : 'drop-shadow(0 1px 3px rgba(255,255,255,0.55))',
            margin: 0,
            textAlign: 'left',
          }}
        >
          Guido <span style={{ color: '#d9534f' }}>❤</span> Melissa · Sposi · 25/08/2026
        </p>
      </div>

      {/* Logo Sposi.live A COLORI, top-right, 1/3 più grande. Niente mix-blend, niente opacità forzata */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-sposi-trans.png"
        alt=""
        className="absolute top-3 right-3 h-[53px] w-auto pointer-events-none"
      />
    </div>
  );
}
