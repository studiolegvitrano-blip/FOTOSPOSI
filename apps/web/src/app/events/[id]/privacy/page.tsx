'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCurrentUser, createClient } from '@fotosposi/core';
import { getConsent, setConsent, getConsentList } from '@fotosposi/face-recognition';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PrivacyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [consented, setConsented] = useState<boolean | null>(null);
  const [consentList, setConsentList] = useState<any[]>([]);

  useEffect(() => {
    getCurrentUser().then(({ user: u, error }) => {
      if (error || !u) { router.push('/login'); return; }
      setUser(u);
      getConsent(id, u.id).then(r => { if (r.consent) setConsented(r.consent.consented); });
      getConsentList(id).then(r => { if (r.consents) setConsentList(r.consents); });
    });
  }, [id]);

  const handleConsent = async (value: boolean) => {
    if (!user) return;
    await setConsent(id, user.id, value);
    setConsented(value);
    const r = await getConsentList(id);
    if (r.consents) setConsentList(r.consents);
  };

  const consentCount = consentList.filter(c => c.consented).length;

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Privacy & Riconoscimento</h1>
        <Button variant="ghost" onClick={() => router.push(`/events/${id}`)}>← Evento</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Riconoscimento facciale (GDPR)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-text-muted">
            Il riconoscimento facciale permette di taggare automaticamente le persone nelle foto dell'evento.
            Attivando questa funzione, il sistema analizzerà i tuoi volti nelle foto caricate.
            Puoi cambiare idea in qualsiasi momento.
          </p>
          <div className="flex gap-3">
            <Button
              variant={consented === true ? 'default' : 'outline'}
              onClick={() => handleConsent(true)}
              className="flex-1"
            >
              ✅ Acconsento
            </Button>
            <Button
              variant={consented === false ? 'destructive' : 'outline'}
              onClick={() => handleConsent(false)}
              className="flex-1"
            >
              ❌ Non acconsento
            </Button>
          </div>
          {consented !== null && (
            <p className={`text-sm text-center ${consented ? 'text-success' : 'text-text-muted'}`}>
              {consented ? 'Hai dato il consenso al riconoscimento facciale' : 'Non hai dato il consenso'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Consensi ricevuti
            {consentList.length > 0 && <Badge>{consentCount}/{consentList.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {consentList.length === 0 ? (
            <p className="text-text-muted text-sm">Nessun consenso ancora registrato</p>
          ) : (
            <div className="space-y-2">
              {consentList.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md border border-border text-sm">
                  <span>{c.user_id}</span>
                  <Badge variant={c.consented ? 'success' : 'secondary'}>{c.consented ? 'Consentito' : 'Negato'}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
