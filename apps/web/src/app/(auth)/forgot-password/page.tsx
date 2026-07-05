'use client';

import { useState } from 'react';
import { requestPasswordReset } from '@fotosposi/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await requestPasswordReset(email);
    setLoading(false);
    // Non riveliamo se l'email esiste o no (evita di far scoprire quali indirizzi sono registrati) —
    // mostriamo sempre lo stesso messaggio di conferma, a meno di un errore di rete/servizio.
    if (err) setError('Si è verificato un errore. Riprova tra poco.');
    else setSent(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-center">Password dimenticata</CardTitle>
        </CardHeader>
        {sent ? (
          <CardContent>
            <p className="text-text-muted text-sm text-center">
              Se l'indirizzo è registrato, ti abbiamo inviato un'email con il link per reimpostare la password.
            </p>
          </CardContent>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Invio...' : 'Invia link di recupero'}</Button>
              <a href="/login" className="text-sm text-brand hover:underline text-center">Torna al login</a>
            </CardFooter>
          </form>
        )}
      </Card>
    </main>
  );
}
