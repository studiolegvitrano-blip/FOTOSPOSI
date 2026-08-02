import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createServerSideClient } from '@fotosposi/core';

/**
 * GET /api/events/[id]/participants — lista partecipanti (chi ha caricato foto/video
 *   sull'evento + chi è registrato come invitato) con il loro role_at_event e il
 *   numero di media caricati. Solo sposo (events.created_by) o delegato con permesso
 *   edit/admin.
 * PATCH /api/events/[id]/participants — aggiorna:
 *   { userId, roleAtEvent }        → imposta il ruolo del partecipante (core_users.role_at_event)
 *   { showUploaderRoles }          → toggle "mostra ruoli in galleria" (events.show_uploader_roles)
 *
 * core_users NON ha policy RLS: le letture/scritture passano dal service role qui.
 */
type Params = { params: Promise<{ id: string }> };

async function authorize(eventId: string): Promise<{ userId: string } | { error: NextResponse }> {
  let userId: string | null = null;
  try {
    const cookieStore = await cookies();
    const supabaseAuth = createServerSideClient(() => cookieStore.getAll());
    const { data } = await supabaseAuth.auth.getUser();
    userId = data?.user?.id ?? null;
  } catch { /* 401 sotto */ }

  if (!userId) {
    return { error: NextResponse.json({ error: 'Non autenticato' }, { status: 401 }) };
  }

  const svc = createServiceClient();
  const { data: event } = await svc
    .from('events')
    .select('created_by')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) {
    return { error: NextResponse.json({ error: 'Evento non trovato' }, { status: 404 }) };
  }

  if (event.created_by === userId) return { userId };

  const { data: manager } = await svc
    .from('event_managers')
    .select('permission')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .in('permission', ['edit', 'admin'])
    .maybeSingle();
  if (manager) return { userId };

  return { error: NextResponse.json({ error: 'Accesso negato' }, { status: 403 }) };
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const auth = await authorize(eventId);
  if ('error' in auth) return auth.error;

  const svc = createServiceClient();

  // Uploader distinti dai media dell'evento (foto + video).
  const { data: mediaRows } = await svc
    .from('media_uploads')
    .select('uploaded_by, created_at')
    .eq('event_id', eventId);
  const uploaderCounts: Record<string, number> = {};
  for (const m of mediaRows ?? []) {
    if (!m.uploaded_by) continue;
    uploaderCounts[m.uploaded_by] = (uploaderCounts[m.uploaded_by] ?? 0) + 1;
  }
  const uploaderIds = Object.keys(uploaderCounts);

  // Invitati registrati (event_guests) — potrebbero non aver ancora caricato nulla.
  const { data: guestRows } = await svc
    .from('event_guests')
    .select('user_id, name, email')
    .eq('event_id', eventId);
  const guestMap = new Map<string, { name?: string; email?: string }>();
  for (const g of guestRows ?? []) {
    if (!g.user_id) continue;
    guestMap.set(g.user_id, { name: g.name, email: g.email });
  }

  const allUserIds = Array.from(new Set([...uploaderIds, ...guestMap.keys()]));

  // Dati profilo (nome/cognome/ruolo) dai core_users.
  const profilesResult = allUserIds.length > 0
    ? await svc
        .from('core_users')
        .select('id, first_name, last_name, name, email, role_at_event')
        .in('id', allUserIds)
    : { data: null as any[] | null, error: null };
  const profiles = profilesResult.data;

  // Evento per il toggle
  const { data: event } = await svc
    .from('events')
    .select('show_uploader_roles')
    .eq('id', eventId)
    .maybeSingle();

  const participants = (profiles ?? []).map((u: any) => {
    const guest = guestMap.get(u.id);
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || guest?.name || u.email || 'Anonimo';
    return {
      user_id: u.id,
      name: fullName,
      email: u.email || guest?.email || null,
      role_at_event: u.role_at_event ?? null,
      media_count: uploaderCounts[u.id] ?? 0,
    };
  });

  return NextResponse.json({
    participants: participants.sort((a: any, b: any) => (b.media_count ?? 0) - (a.media_count ?? 0)),
    show_uploader_roles: event?.show_uploader_roles ?? true,
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const auth = await authorize(eventId);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => ({}));
  const svc = createServiceClient();

  if (typeof body.showUploaderRoles === 'boolean') {
    const { error } = await svc
      .from('events')
      .update({ show_uploader_roles: body.showUploaderRoles })
      .eq('id', eventId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, show_uploader_roles: body.showUploaderRoles });
  }

  if (body.userId && typeof body.roleAtEvent === 'string') {
    const { error } = await svc
      .from('core_users')
      .update({ role_at_event: body.roleAtEvent || null })
      .eq('id', body.userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Body non valido: servono { userId, roleAtEvent } oppure { showUploaderRoles }' }, { status: 400 });
}
