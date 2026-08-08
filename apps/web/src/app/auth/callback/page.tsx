'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Tipi editor(PostLoginOnboarding): form dati invitato dopo OAuth per invitati via QR.
type OnboardingState = 'loading' | 'onboarding' | 'redirecting';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<OnboardingState>('loading');
  const [pendingUser, setPendingUser] = useState<{ id: string; email?: string; name?: string; eventId: string } | null>(null);

  useEffect(() => {
    const handleHash = async () => {
      const { createClient } = await import('@fotosposi/core');
      const { resolveOAuthSession } = await import('@/lib/oauth-callback');
      const supabase = createClient();

      const code = searchParams.get('code');
      const { session, error: oauthErr } = await resolveOAuthSession(supabase.auth, {
        code,
        hash: typeof window !== 'undefined' ? window.location.hash : '',
      });

      if (oauthErr) {
        console.error('[auth/callback] OAuth resolve fallito:', oauthErr);
        // Se lo scambio fallisce (es. code reuse, PKCE verifier perso), torniamo al login
        // invece di restare bloccati a "reindirizzamento" in eterno — sintomo tipico
        // dell'utente che chiuso/riaperto il tab durante l'OAuth (code_verifier è in
        // sessionStorage e si perde). Dare feedback visibile è meglio di un loop morto.
        router.replace('/login?error=oauth_failed');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const redirect = searchParams.get('redirect');
      if (!user) {
        // Sessione non creata: niente code né hash. Caso raro (es. link diretto a /auth/callback
        // senza parametri). Indirizziamo al login invece di restare "reindirizzamento" in eterno.
        router.replace('/login');
        return;
      }

      const eventIdMatch = (redirect || '').match(/^\/events\/([^/]+)\//);
      const eventId = eventIdMatch ? eventIdMatch[1] : '';

      // Verifica se core_users esiste già. Se sì, l'utente si è già registrato (primo login
      // avvenuto in sessione precedente) — saltiamo l'onboarding e proseguiamo col redirect.
      // Questo risolve il caso "utente registrato da browser" che NON deve reinserire i dati
      // form post-OAuth a ogni login successivo (solo primo login = onboarding).
      try {
        const checkRes = await fetch('/api/auth/check-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        const checkData = await checkRes.json();
        if (checkData?.exists) {
          // Utente già registrato: setup già fatto in sessione precedente → redirect diretto,
          // niente form. Questo è il path che attiva "rimanere collegato" auch dopo refresh/chiusura.
          await finalizeAndRedirect(redirect || '/dashboard');
          return;
        }
      } catch {
        // Se il check fallisce (transient), assumiamo nuovo utente → form onboarding.
        // Meglio chiedere due volte che perdere l'onboarding di un invitato.
      }

      // NUOVO UTENTE (primo login via OAuth).
      // Se è invitato via QR (redirect punta a /events/{id}/...), apriamo il form di onboarding
      // (nome/cognome/email prefill/telefono/ruolo). Se è uno sposo che si sta registrando,
      // saltiamo l'onboarding — sarà la creazione evento a gestire i suoi dati.
      if (eventId) {
        setPendingUser({
          id: user.id,
          email: user.email ?? undefined,
          name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
          eventId,
        });
        setState('onboarding');
      } else {
        // Sposo (no eventId nel redirect): setup base automatico senza form onboarding.
        try {
          await fetch('/api/auth/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              email: user.email,
              name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'Utente',
              gdprConsent: true,
            }),
          });
        } catch { /* non bloccare */ }
        await finalizeAndRedirect(redirect || '/dashboard');
      }
    };

    /**
     * Finalizza il login con NAVIGAZIONE COMPLETA (window.location.href), non router.push.
     *
     * Perché: router.push è una navigazione client-side in cui Next.js può servire /dashboard
     * dal prefetch RSC o dal client-router cache di PRIMA del login (quando eri anonimo e il
     * middleware aveva risposto "redirect a /login"). Risultato: anche con i cookie auth appena
     * scritti da `exchangeCodeForSession`, il redirect finale viene risolto con la risposta
     * cached del middleware pre-login → rimbalzo a /login → loop OAuth (sintomo reale in
     * produzione: 4 token 200 su 3 account Google, ma l'utente non atterrava mai su /dashboard).
     *
     * window.location.href forza un reload completo del documento: il browser manda i cookie
     * freschi al server, il middleware gira di nuovo e vede getUser() != null. Il login EMAIL
     * non è toccato (router.push lì funziona perché la navigazione parte dalla stessa SPA già
     * autenticata), ma per il ritorno da OAuth (tab portata fuori/riportata da Google) la
     * navigazione hard è l'unico percorso deterministico.
     */
    async function finalizeAndRedirect(target: string) {
      setState('redirecting');
      // Un tick per dare al browser il tempo di persistere i cookie prima della navigazione hard.
      await new Promise((r) => setTimeout(r, 50));
      window.location.href = target;
    }

    handleHash();
  }, [router, searchParams]);

  // Form di onboarding per invitati via QR (solo primo login dopo OAuth Google/Facebook/Apple).
  // Si mostra QUANDO: 1) OAuth successo, 2) nessun core_users esistente, 3) redirect punta a
  // /events/{id}/ (invitato via QR). Lo sposo non vede questo form: lui registra il proprio evento.
  if (state === 'onboarding' && pendingUser) {
    return <OnboardingForm
      user={pendingUser}
      redirect={searchParams.get('redirect') || `/events/${pendingUser.eventId}`}
      onComplete={async () => {
        setState('redirecting');
        // Navigazione hard anche qui: stessa race router.push/prefetch del middleware del
        // path principale. Dopo il setup, i cookie auth sono appena stati scritti → il
        // browser ricarica la pagina di destinazione con la sessione fresca.
        await new Promise((r) => setTimeout(r, 50));
        window.location.href = searchParams.get('redirect') || `/events/${pendingUser.eventId}`;
      }}
    />;
  }

  return <main className="min-h-screen flex items-center justify-center p-4"><p>Reindirizzamento in corso...</p></main>;
}

/**
 * Form post-OAuth per invitati via QR. Mostra nome/cognome (prefill da OAuth metadata se disponibili),
 * email (prefill, editabile — alcuni provider non danno email verificata, l'utente può correggere),
 * telefono (obbligatorio), ruolo (Testimone/Parente/Amico/Altro con campo manuale per "Altro").
 *
 * Submit → POST /api/auth/setup con role_at_event + phone → riga core_users creata → redirect.
 */
function OnboardingForm({ user, redirect, onComplete }: {
  user: { id: string; email?: string; name?: string; eventId: string };
  redirect: string;
  onComplete: () => Promise<void>;
}) {
  // Pre-fill da OAuth metadata: Google restituisce `full_name` e `email`, Facebook `name`+`email`,
  // Apple solo `email` (nasconde il nome per privacy). Splittiamo full_name in first/last per
  // compilazione automatica — l'utente può correggere entrambi.
  const nameParts = (user.name || '').split(' ').filter(Boolean);
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('testimone-sposa');
  const [customRole, setCustomRole] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Inserisci nome e cognome');
      return;
    }
    if (!phone.trim() || phone.trim().length < 6) {
      setError('Inserisci un numero di telefono valido');
      return;
    }
    if (role === 'altro' && !customRole.trim()) {
      setError('Specifica il ruolo personalizzato');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email,
          name: `${firstName} ${lastName}`,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          gdprConsent: true,
          eventId: user.eventId,
          roleAtEvent: role === 'altro' ? customRole.trim() : role,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Errore durante la registrazione');
        setSubmitting(false);
        return;
      }
      await onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore di rete');
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-md bg-surface rounded-lg border border-border shadow-md p-6">
        <h1 className="text-xl font-bold mb-1">Completa la registrazione</h1>
        <p className="text-sm text-text-muted mb-4">Inserisci i tuoi dati per partecipare al matrimonio</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium" htmlFor="firstName">Nome</label>
              <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-surface" required />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="lastName">Cognome</label>
              <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-surface" required />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-surface" required />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="phone">Telefono <span className="text-error">*</span></label>
            <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+39 333 1234567"
              className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-surface" required />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="role">Ruolo</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 bg-surface">
              <option value="testimone-sposa">Testimone della sposa</option>
              <option value="testimone-sposo">Testimone dello sposo</option>
              <option value="padre">Padre</option>
              <option value="madre">Madre</option>
              <option value="amico">Amico</option>
              <option value="parente">Parente</option>
              <option value="altro">Altro (specifica)</option>
            </select>
            {role === 'altro' && (
              <input value={customRole} onChange={(e) => setCustomRole(e.target.value)}
                placeholder="es. Collega di lavoro, Fornitore, etc."
                className="mt-2 w-full rounded-md border border-border px-3 py-2 bg-surface" required />
            )}
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full bg-brand text-white rounded-md py-2 font-medium disabled:opacity-50">
            {submitting ? 'Registrazione...' : 'Completa registrazione'}
          </button>
        </form>
      </div>
    </main>
  );
}
