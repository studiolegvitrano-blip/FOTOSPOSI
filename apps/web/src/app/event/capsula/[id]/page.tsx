import { getCapsuleByToken, updateCapsule } from '@fotosposi/time-capsule';
import { getPresignedDownloadUrl } from '@fotosposi/r2-storage';

type Params = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Capsula del Tempo — Sposi.live',
  robots: { index: false },
};

/**
 * Vista pubblica del destinatario (link via email/WhatsApp): protegge con
 * access_token (?t=). Prima della data di trasmissione mostra solo il countdown;
 * dopo, il video watermarkato (presigned, chiave principale).
 */
export default async function Page({ params, searchParams }: Params & { searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t: token } = await searchParams;

  if (!token) {
    return <NotFound message="Link non valido: manca il token di accesso." />;
  }

  const { message: capsule, error } = await getCapsuleByToken(id, token);
  if (error || !capsule) {
    return <NotFound message={error || 'Capsula non trovata o link non valido.'} />;
  }

  const due = new Date(capsule.reveal_at).getTime() <= Date.now();

  if (!due) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Capsula del Tempo</h1>
          <p className="text-sm text-muted-foreground">
            Questa capsula si aprirà il{' '}
            <strong>{new Date(capsule.reveal_at).toLocaleDateString('it-IT')}</strong>. Torna in quella data.
          </p>
        </div>
      </div>
    );
  }

  let videoUrl: string | null = null;
  if (capsule.r2_key) {
    videoUrl = await getPresignedDownloadUrl(capsule.r2_key, 3600);
  }

  if (!videoUrl) {
    return <NotFound message="Il video della capsula non è ancora disponibile." />;
  }

  // Prima apertura del destinatario dopo la scadenza: segna come scaricata.
  if (!capsule.downloaded_at) {
    await updateCapsule(capsule.id, { downloaded_at: new Date().toISOString() });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold">Capsula del Tempo</h1>
          <p className="text-sm text-muted-foreground">
            Da <strong>{capsule.sender_name}</strong>
            {capsule.recipient_name ? ` a ${capsule.recipient_name}` : ''} — aperta il{' '}
            {new Date(capsule.reveal_at).toLocaleDateString('it-IT')}
          </p>
        </div>
        <video src={videoUrl} controls playsInline className="w-full rounded-lg border bg-black" />
      </div>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
