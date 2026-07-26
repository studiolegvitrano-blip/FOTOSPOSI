import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSideClient, createServiceClient, rateLimit } from '@fotosposi/core';

/**
 * API server-side per la coda di upload degli ospiti.
 *
 * Prima il browser scriveva direttamente su `upload_queue` con enqueueUpload/updateQueueItem
 * (packages/media/src/queue.ts): nel browser createServiceClient() degrada alla anon key
 * SENZA la sessione utente (è un client supabase-js "nudo", non il browser client di
 * @supabase/ssr), quindi auth.uid() era NULL e la RLS rifiutava l'INSERT con
 * "new row violates row-level security policy for table upload_queue" — sia per i file
 * scelti dalla galleria sia per gli scatti fotocamera.
 *
 * Qui invece: autentichiamo l'utente dai cookie di sessione, poi operiamo con la vera
 * service role key (che esiste solo lato server), vincolando ogni scrittura all'utente
 * autenticato. Azioni: enqueue, mark (r2_key dopo upload R2), fail, state (coda+stats).
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rl = rateLimit(`queue-api:${ip}`, 60, 60000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Troppe richieste. Riprova tra qualche secondo.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) } },
    );
  }

  try {
    const cookieStore = await cookies();
    const authClient = createServerSideClient(() => cookieStore.getAll());
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body as { action: string };
    const svc = createServiceClient();

    if (action === 'enqueue') {
      const { eventId, fileName, fileType, fileSize, compressed } = body;
      if (!eventId || !fileName) {
        return NextResponse.json({ error: 'eventId e fileName richiesti' }, { status: 400 });
      }

      const { data: event } = await svc
        .from('events')
        .select('id, created_by, allow_guest_media')
        .eq('id', eventId)
        .single();
      if (!event) return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });

      const isCreator = event.created_by === user.id;
      if (!isCreator && event.allow_guest_media === false) {
        return NextResponse.json({ error: 'Gli sposi non hanno abilitato il caricamento da parte degli invitati' }, { status: 403 });
      }

      const { data, error } = await svc
        .from('upload_queue')
        .insert({
          event_id: eventId,
          uploaded_by: user.id,
          file_name: fileName,
          file_type: fileType || 'application/octet-stream',
          file_size: fileSize || 0,
          status: 'pending',
          compressed: compressed ?? false,
        })
        .select('id')
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ id: data.id });
    }

    if (action === 'mark') {
      const { id, r2Key } = body;
      if (!id || !r2Key) return NextResponse.json({ error: 'id e r2Key richiesti' }, { status: 400 });
      const { error } = await svc
        .from('upload_queue')
        .update({ r2_key: r2Key })
        .eq('id', id)
        .eq('uploaded_by', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'fail') {
      // Errore definitivo del client: marca failed + retry alto per esclude dai prossimi sweep.
      // Usato solo quando il file non è proprio in R2 E non può esserci (es. validazione MIME
      // rifiutata). Per errori temporanei (presigned URL timeout, PUT R2 502) si usa 'retry'.
      const { id, error: errMsg } = body;
      if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });
      const { error } = await svc
        .from('upload_queue')
        .update({ status: 'failed', error: String(errMsg || 'Errore client').slice(0, 500), retry_count: 99 })
        .eq('id', id)
        .eq('uploaded_by', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'retry') {
      // Errore temporaneo del client (es. presigned URL/PUT timeout). Mantieni la riga
      // pending: il cron o un successivo 'mark' può recuperarla. Vedi stress test 26/07:
      // qui PRIMA questo codice marcava 'failed' e il cron la saltava per sempre.
      const { id, error: errMsg } = body;
      if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 });
      const { error } = await svc
        .from('upload_queue')
        .update({
          error: String(errMsg || 'Retry da client').slice(0, 500),
          // NON toccare status (resta pending). NON toccare r2_key (se già valorizzato resta).
          retry_count: 0,
        })
        .eq('id', id)
        .eq('uploaded_by', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'state') {
      const { eventId } = body;
      if (!eventId) return NextResponse.json({ error: 'eventId richiesto' }, { status: 400 });

      const [{ data: pending }, { data: all }] = await Promise.all([
        svc
          .from('upload_queue')
          .select('*')
          .eq('event_id', eventId)
          .in('status', ['pending', 'processing', 'failed'])
          .order('created_at', { ascending: true }),
        svc.from('upload_queue').select('status').eq('event_id', eventId),
      ]);

      const items: { status: string }[] = all ?? [];
      const stats = {
        pending: items.filter((i: { status: string }) => i.status === 'pending').length,
        processing: items.filter((i: { status: string }) => i.status === 'processing').length,
        synced: items.filter((i: { status: string }) => i.status === 'synced').length,
        failed: items.filter((i: { status: string }) => i.status === 'failed').length,
      };
      return NextResponse.json({ items: pending ?? [], stats });
    }

    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
