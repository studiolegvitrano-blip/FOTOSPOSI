'use client';

import { useEffect, useState } from 'react';

// Badge "scarica l'app" in stile App Store/Google Play, ma senza pubblicazione reale sugli store
// (l'app è una PWA, decisione presa in una sessione precedente) — cliccando si installa
// direttamente la PWA (Android) o si mostrano le istruzioni "Aggiungi a Home" (iOS), invece di
// aprire una scheda store che non esiste. Icone disegnate da zero (non i loghi ufficiali Apple/
// Google Play, che sono marchi registrati) per restare nello stile riconoscibile senza copiarli.
export function AppDownloadBadges() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [androidMsg, setAndroidMsg] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleAndroidClick = async () => {
    if (installPrompt) {
      (installPrompt as unknown as { prompt: () => void }).prompt();
      setInstallPrompt(null);
    } else {
      setAndroidMsg('Apri questo sito con Chrome su Android per installare l\'app, poi riprova.');
      setTimeout(() => setAndroidMsg(''), 4000);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-2">
      {showIosHelp && (
        <div className="bg-black/90 text-white text-xs rounded-lg p-3 max-w-[220px] shadow-lg">
          Su iPhone: tocca <strong>Condividi</strong> (icona quadrato con freccia in su nella barra di Safari), poi <strong>"Aggiungi a Home"</strong>.
          <button onClick={() => setShowIosHelp(false)} className="block mt-2 text-white/70 underline text-xs">Chiudi</button>
        </div>
      )}
      {androidMsg && (
        <div className="bg-black/90 text-white text-xs rounded-lg p-3 max-w-[220px] shadow-lg">{androidMsg}</div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => setShowIosHelp(true)}
          className="flex items-center gap-2 bg-black text-white rounded-lg px-3 py-2 shadow-lg hover:bg-gray-800 transition-colors"
          aria-label="Aggiungi a Home su iPhone"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5" y="2" width="14" height="20" rx="2.5" />
            <line x1="5" y1="18" x2="19" y2="18" />
          </svg>
          <span className="text-left leading-tight">
            <span className="block text-[9px] text-white/70">Disponibile su</span>
            <span className="block text-sm font-semibold -mt-0.5">iPhone</span>
          </span>
        </button>
        <button
          onClick={handleAndroidClick}
          className="flex items-center gap-2 bg-black text-white rounded-lg px-3 py-2 shadow-lg hover:bg-gray-800 transition-colors"
          aria-label="Installa app su Android"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M5 19h14" />
          </svg>
          <span className="text-left leading-tight">
            <span className="block text-[9px] text-white/70">Scarica su</span>
            <span className="block text-sm font-semibold -mt-0.5">Android</span>
          </span>
        </button>
      </div>
    </div>
  );
}
