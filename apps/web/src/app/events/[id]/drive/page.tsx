'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser } from '@fotosposi/core';
import { getDriveToken, deleteDriveToken } from '@fotosposi/media';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DrivePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const success = searchParams.get('success') === 'true';
  const errorParam = searchParams.get('error');

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      loadToken();
    });
  }, [id]);

  const loadToken = async () => {
    setLoading(true);
    const r = await getDriveToken(id);
    if (r.token) setToken(r.token);
    setLoading(false);
  };

  const handleConnect = () => {
    window.location.href = `/api/auth/google?event_id=${id}`;
  };

  const handleDisconnect = async () => {
    setDeleting(true);
    await deleteDriveToken(id);
    setToken(null);
    setDeleting(false);
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <main className="max-w-lg mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Google Drive</h1>
        <Button variant="ghost" onClick={() => router.push(`/events/${id}`)}>← Evento</Button>
      </div>

      {success && (
        <Card className="border-success">
          <CardContent className="py-3 text-sm text-success">Drive collegato con successo!</CardContent>
        </Card>
      )}

      {errorParam && (
        <Card className="border-error">
          <CardContent className="py-3 text-sm text-error">Errore: {errorParam}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Collegamento Drive
            {token && <Badge variant="success">Connesso</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-text-muted">
            Collega il tuo Google Drive personale per fare il backup automatico di foto e video dell'evento.
          </p>

          {!loading && !token && (
            <div className="p-4 rounded-lg bg-muted text-sm space-y-2">
              <p><strong>Come funziona:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-text-muted">
                <li>Clicca "Connetti Google Drive"</li>
                <li>Accedi con il tuo account Google</li>
                <li>Autorizza l'accesso a Drive</li>
                <li>Ogni foto/video caricato verrà automaticamente salvato in una cartella dedicata</li>
              </ol>
            </div>
          )}

          {token && (
            <div className="text-sm space-y-1">
              <p><strong>Account collegato:</strong> {token.drive_email || 'Google Drive'}</p>
              <p className="text-text-muted">Connesso dal {new Date(token.created_at).toLocaleDateString('it-IT')}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          {!token && <Button onClick={handleConnect} disabled={loading}>Connetti Google Drive</Button>}
          {token && <Button variant="destructive" onClick={handleDisconnect} disabled={deleting}>{deleting ? 'Disconnessione...' : 'Disconnetti'}</Button>}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Configurazione necessaria</CardTitle></CardHeader>
        <CardContent className="text-sm text-text-muted space-y-2">
          <p>Per usare questa funzionalità, l'amministratore deve:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Andare su <a href="https://console.cloud.google.com" target="_blank" rel="noopener" className="text-brand hover:underline">Google Cloud Console</a></li>
            <li>Creare un progetto e abilitare Google Drive API</li>
            <li>Creare OAuth 2.0 Credentials (tipo Web application)</li>
            <li>Aggiungere <code className="bg-muted px-1 rounded">{appUrl}/api/auth/google/callback</code> come redirect URI</li>
            <li>Mettere Client ID e Secret in <code className="bg-muted px-1 rounded">.env.local</code></li>
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
