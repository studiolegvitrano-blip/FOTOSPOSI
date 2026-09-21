import { createServiceClient } from '@fotosposi/core';
import { CapsulePageServer } from '@/app/events/[id]/capsule/capsule-server';

type Params = { params: Promise<{ code: string }> };

export const metadata = {
  title: 'Capsula del Tempo — Sposi.live',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

/** Pagina invitato via codice evento: risolve code → eventId, poi la stessa pagina. */
export default async function Page({ params }: Params) {
  const { code } = await params;
  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('event_codes')
    .select('event_id')
    .eq('code', code)
    .maybeSingle();

  if (!row?.event_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Evento non trovato per il codice {code}.</p>
      </div>
    );
  }

  return <CapsulePageServer eventId={row.event_id} />;
}
