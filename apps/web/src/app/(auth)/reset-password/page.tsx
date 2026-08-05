'use client';

import { useEffect, useState } from 'react';
import { updatePassword } from '@fotosposi/core';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Il link nell'email di recupero porta qui con i token di sessione nell'hash dell'URL
    // (stesso meccanismo di /auth/callback) — vanno raccolti prima di poter chiamare updateUser.
    const init = async () => {
      const { createClient } = await import('@fotosposi/core');
      const supabase = createClient();
      if (window.location.hash) {
        await supabase.auth.getSession();
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setInvalidLink(true); }
      setReady(true);
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La password deve avere almeno 6 caratteri'); return; }
    if (password !== confirmPassword) { setError('Le due password non coincidono'); return; }
    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);
    if (err) setError('Impossibile aggiornare la password. Riprova.');
    else {
      setDone(true);
      setTimeout(() => router.push('/dashboard'), 1500);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">Reimposta password</CardTitle>
        </CardHeader>
        {!ready ? (
          <CardContent><p className="text-sm text-text-muted text-center">Verifica in corso...</p></CardContent>
        ) : invalidLink ? (
          <CardContent>
            <p className="text-sm text-error text-center">
              Il link non è valido o è scaduto. <a href="/forgot-password" className="text-brand hover:underline">Richiedine uno nuovo</a>.
            </p>
          </CardContent>
        ) : done ? (
          <CardContent><p className="text-sm text-success text-center">Password aggiornata! Reindirizzamento...</p></CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nuova password</Label>
                <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma nuova password</Label>
                <PasswordInput id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Salvataggio...' : 'Salva nuova password'}</Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </main>
  );
}
