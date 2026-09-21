import { cookies } from 'next/headers';
import { createServerSideClient } from '@fotosposi/core';
import { getEventGuests } from '@fotosposi/core';
import { authorizeCapsuleAccess } from '@/lib/capsule-auth';
import { CapsuleClient } from './capsule-client';

/**
 * Pagina Capsula del Tempo (sposi + invitato approvato): stesso pattern
 * Server Component → client island per interattività.
 */
export async function CapsulePageServer({ eventId }: { eventId: string }) {
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
    const { data } = await supabaseAuth.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch { /* redirect sotto */ }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Capsula del Tempo</h1>
          <p className="text-sm text-muted-foreground">
            Accedi per creare o guardare le capsule del tempo.
          </p>
          <a
            href={`/login?redirect=${encodeURIComponent(`/events/${eventId}/capsule`)}`}
            className="inline-block rounded-md bg-rose-600 px-4 py-2 text-white text-sm font-medium"
          >
            Accedi
          </a>
        </div>
      </div>
    );
  }

  const auth = await authorizeCapsuleAccess(eventId);
  if ('error' in auth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold">Capsula del Tempo</h1>
          <p className="text-sm text-muted-foreground">
            Accesso riservato a sposi, delegati e invitati approvati di questo evento.
          </p>
        </div>
      </div>
    );
  }

  const isCouple = auth.role === 'couple';
  let guests: Array<{ id: string; name: string }> = [];
  if (isCouple) {
    const { guests: eventGuests } = await getEventGuests(eventId);
    guests = (eventGuests ?? [])
      .filter((g) => g.status === 'approved')
      .map((g) => ({ id: g.id, name: g.name }));
  }

  return (
    <CapsuleClient
      eventId={eventId}
      isCouple={isCouple}
      guests={guests}
      backHref={isCouple ? `/events/${eventId}` : undefined}
    />
  );
}
