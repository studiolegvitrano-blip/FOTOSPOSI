'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { ShieldCheck, Lock, Loader2 } from 'lucide-react';

export default function CeoLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/ceo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push('/ceo');
      } else {
        setError(data.error || 'Accesso negato');
      }
    } catch {
      setError('Errore di connessione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-6 h-6 text-brand" />
          </div>
          <CardTitle className="text-xl">Console CEO</CardTitle>
          <p className="text-sm text-text-muted">Area riservata alla gestione della piattaforma</p>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ceo-password">Password di accesso</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <Input
                  id="ceo-password"
                  type="password"
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  autoFocus
                  required
                />
              </div>
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accedi'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
