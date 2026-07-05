'use client';

import { useEffect } from 'react';

// Il manifest PWA (apps/web/src/app/manifest.ts) ha uno `start_url` fisso su "/" — è un limite
// dello standard Web App Manifest: non può puntare dinamicamente all'evento che l'ospite stava
// guardando quando ha fatto "Aggiungi a schermata Home" da /event/[code]. Risultato: l'icona
// installata su Android apriva sempre la homepage marketing (senza pulsante Carica, stile
// generico) invece della pagina del matrimonio con foto/video.
//
// Fix: /event/[code]/page.tsx salva l'ultimo codice evento visitato in localStorage; qui, solo
// quando l'app è aperta in modalità standalone (icona home screen, non il browser normale),
// reindirizziamo subito a quell'evento invece di mostrare la homepage.
const LAST_EVENT_KEY = 'fotosposi_last_event_code';

export function rememberLastEventCode(code: string) {
  try { localStorage.setItem(LAST_EVENT_KEY, code); } catch { /* storage non disponibile, ignora */ }
}

export function PwaEventRedirect() {
  useEffect(() => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (!isStandalone) return;

    let code: string | null = null;
    try { code = localStorage.getItem(LAST_EVENT_KEY); } catch { /* ignora */ }
    if (code) window.location.replace(`/event/${code}`);
  }, []);

  return null;
}
