import { NextRequest, NextResponse } from 'next/server';
import { getServerUserId, assertEventManager, brandName, loadLogoDataUri } from '@/lib/invitations.server';
import { listGuests, buildInvitedListWordHtml, buildInvitedListPdfHtml, buildInvitedListCsv } from '@fotosposi/invitations';

/**
 * GET /api/events/[id]/invitations/export?format=pdf|word|csv
 * Scarica la lista invitati. pdf = HTML print-friendly (stampa → PDF);
 * word = documento .doc (HTML compatibile Word); csv = Excel (BOM UTF-8, ;).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG = 'Lista-Invitati';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const userId = await getServerUserId();
  if (!userId) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });

  const access = await assertEventManager(eventId, userId);
  if (!access.ok) return NextResponse.json({ error: access.error, status: access.status });
  const event = access.event as Record<string, unknown>;

  const format = req.nextUrl.searchParams.get('format') ?? 'pdf';
  if (!['pdf', 'word', 'csv'].includes(format)) {
    return NextResponse.json({ error: 'Formato non valido (pdf|word|csv)' }, { status: 400 });
  }

  const guests = await listGuests(eventId);
  const brand = brandName(event?.brand as string | null);
  const meta = {
    brand,
    coupleName: String(event?.couple_name || ''),
    generatedAt: new Date().toISOString(),
    logoDataUri: loadLogoDataUri(event?.brand as string | null),
  };

  if (format === 'word') {
    const html = buildInvitedListWordHtml(guests, meta);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'application/msword; charset=utf-8',
        'Content-Disposition': `attachment; filename="${SLUG}.doc"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'csv') {
    const csv = buildInvitedListCsv(guests, true);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${SLUG}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const html = buildInvitedListPdfHtml(guests, meta);
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
