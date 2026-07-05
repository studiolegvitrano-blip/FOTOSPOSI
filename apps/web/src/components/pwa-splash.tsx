'use client';

import { useEffect, useState } from 'react';

// Schermata di apertura mostrata solo quando l'app è avviata da icona home screen (PWA
// installata, "display-mode: standalone") — non nel normale browser, dove la homepage stessa
// fa già da prima schermata. Stessa foto/logo dell'hero della homepage, per coerenza visiva tra
// "apertura del sito" e "apertura dell'app installata".
export function PwaSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;

    setVisible(true);
    const fadeTimer = setTimeout(() => setFading(true), 1000);
    const hideTimer = setTimeout(() => setVisible(false), 1300);
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  const isIt = typeof window !== 'undefined' && !window.location.hostname.includes('justmarry');
  const logoSrc = isIt ? '/logo-sposi.png' : '/logo-justmarry.png';

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-cover bg-center transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
      style={{ backgroundImage: 'url(/hero-wedding.jpg)' }}
    >
      <div className="absolute inset-0 bg-black/50" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoSrc} alt="" style={{ opacity: 0.6, mixBlendMode: 'screen' }} className="relative h-24 w-auto" />
    </div>
  );
}
