'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleHash = async () => {
      const { createClient } = await import('@fotosposi/core');
      const supabase = createClient();
      if (window.location.hash) {
        await supabase.auth.getSession();
      }

      // Il login via Google/Facebook/Apple non passava mai da /api/auth/setup (a differenza della
      // registrazione via email), quindi un utente nuovo via OAuth non aveva mai una riga
      // core_users — qualunque controllo RLS basato su core_users (media_uploads, ecc.) falliva
      // in silenzio. La creiamo qui, una tantum, al primo accesso via OAuth.
      const { data: { user } } = await supabase.auth.getUser();
      const redirect = searchParams.get('redirect');
      if (user) {
        const eventIdMatch = (redirect || '').match(/^\/events\/([^/]+)\//);
        try {
          await fetch('/api/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              email: user.email,
              name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Utente',
              gdprConsent: true,
              eventId: eventIdMatch ? eventIdMatch[1] : undefined,
            }),
          });
        } catch { /* non bloccare il redirect se questa chiamata fallisce */ }
      }

      // `redirect` porta l'utente esattamente dove stava andando prima del login/OAuth/conferma
      // email (es. l'evento a cui era stato invitato via QR) invece di finire sempre su /dashboard
      // — senza questo un ospite invitato "perdeva l'invito" dopo essersi registrato.
      router.push(redirect || '/dashboard');
    };
    handleHash();
  }, [router, searchParams]);

  return <main className="min-h-screen flex items-center justify-center p-4"><p>Reindirizzamento in corso...</p></main>;
}
