import { NextRequest, NextResponse } from 'next/server';
import {
  getCapsuleById,
  updateCapsule,
  submitCapsuleWatermarkJob,
} from '@fotosposi/time-capsule';
import { getEventById } from '@fotosposi/events';
import { getEventPartner } from '@fotosposi/partner';
import { updateOrderStatus, verifyCapsuleCheckoutSession } from '@fotosposi/commerce';
import { authorizeCapsuleAccess } from '@/lib/capsule-auth';
import { buildCapsuleBranding } from '@/lib/capsule-watermark';

type Params = { params: Promise<{ id: string }> };

/**
 * POST {sessionId, capsuleId} — verifica il pagamento Stripe della capsula
 * (checkout session paid + metadata.capsule_id, nessun webhook necessario).
 * Su pagamento ok: order → paid, capsula → processing + submit job watermark.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const auth = await authorizeCapsuleAccess(eventId);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => ({})) as { sessionId?: string; capsuleId?: string };
  if (!body.sessionId || !body.capsuleId) {
    return NextResponse.json({ error: 'Missing sessionId o capsuleId' }, { status: 400 });
  }

  const { message: capsule } = await getCapsuleById(body.capsuleId);
  if (!capsule || capsule.event_id !== eventId) {
    return NextResponse.json({ error: 'Capsula non trovata' }, { status: 404 });
  }
  if (capsule.sender_user_id !== auth.userId) {
    return NextResponse.json({ error: 'Solo chi ha creato la capsula può confermarla' }, { status: 403 });
  }

  // Idempotenza: double-confirm (retry/refresh) = doppio submitVideoWatermarkJob
  // → doppio encode VPS. Già processata → ok esplicito.
  if (capsule.status !== 'awaiting_payment') {
    return NextResponse.json({ capsule, ok: true, already: true });
  }

  const verification = await verifyCapsuleCheckoutSession({ sessionId: body.sessionId, capsuleId: capsule.id });
  if (verification.error) return NextResponse.json({ error: verification.error }, { status: 500 });
  if (!verification.paid) {
    return NextResponse.json({ error: 'Pagamento non completato' }, { status: 402 });
  }

  if (capsule.order_id) {
    await updateOrderStatus(capsule.order_id, 'paid', verification.paymentIntent);
  }

  const { event } = await getEventById(eventId);
  const { partner } = await getEventPartner(eventId);
  const branding = await buildCapsuleBranding({
    brand: event?.brand,
    watermarkFont: event?.watermark_font,
    partnerLogoUrl: partner?.logo_url,
    phrase: capsule.watermark_phrase,
  });

  const sourceKey = capsule.original_r2_key || capsule.r2_key;
  if (!sourceKey) {
    await updateCapsule(capsule.id, { status: 'failed', last_error: 'Capsula senza r2_key' });
    return NextResponse.json({ error: 'Capsula senza video' }, { status: 500 });
  }

  const submit = await submitCapsuleWatermarkJob(capsule.id, sourceKey, branding);
  if (submit.error) {
    await updateCapsule(capsule.id, { status: 'failed', last_error: submit.error });
    return NextResponse.json({ error: submit.error }, { status: 500 });
  }

  const { message: updated } = await updateCapsule(capsule.id, {
    status: 'processing',
    video_job_id: submit.jobId ?? null,
  });
  return NextResponse.json({ capsule: updated ?? capsule, ok: true });
}
