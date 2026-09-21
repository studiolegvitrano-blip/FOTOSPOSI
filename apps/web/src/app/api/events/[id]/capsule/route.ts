import { NextRequest, NextResponse } from 'next/server';
import {
  createCapsuleMessage,
  getCapsuleMessages,
  getCapsulesForUser,
  getCapsulesForRecipientGuest,
  updateCapsule,
  computeCapsulePriceCents,
  capsulePaymentRequired,
  submitCapsuleWatermarkJob,
  CAPSULE_MAX_PHRASE_CHARS,
  CAPSULE_MIN_MONTHS,
  CAPSULE_MAX_MONTHS,
  clampCapsuleMonths,
} from '@fotosposi/time-capsule';
import { getEventById } from '@fotosposi/events';
import { getEventPartner } from '@fotosposi/partner';
import { getPresignedDownloadUrl, getPresignedUploadUrl } from '@fotosposi/r2-storage';
import { authorizeCapsuleAccess } from '@/lib/capsule-auth';
import { buildCapsuleBranding } from '@/lib/capsule-watermark';
import { createOrder, createCapsuleCheckoutSession } from '@fotosposi/commerce';

type Params = { params: Promise<{ id: string }> };

function monthsUntil(deliverAt: string): { months: number; error?: string } {
  const d = new Date(deliverAt);
  if (Number.isNaN(d.getTime())) return { months: 0, error: 'Data di trasmissione non valida' };
  const now = Date.now();
  const months = (d.getTime() - now) / (1000 * 60 * 60 * 24 * 30.4375);
  return { months: Math.round(months * 10) / 10 };
}

function isSafeUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://localhost');
}

function sanitize(s: string | undefined | null, max: number): string | null {
  const v = (s || '').trim();
  if (!v) return null;
  return v.slice(0, max);
}

/** POST — crea una capsula video (sposi → invitato/email/WhatsApp; invitato → solo sposi). */
export async function POST(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const auth = await authorizeCapsuleAccess(eventId);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => ({})) as {
    videoR2Key?: string;
    watermarkPhrase?: string;
    deliverAt?: string;
    recipientType?: string;
    recipientName?: string;
    recipientGuestId?: string;
    recipientEmail?: string;
    recipientWhatsapp?: string;
    senderType?: string;
    senderName?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!body.videoR2Key) {
    return NextResponse.json({ error: 'Video non caricato' }, { status: 400 });
  }

  const phrase = (body.watermarkPhrase || '').trim().slice(0, CAPSULE_MAX_PHRASE_CHARS) || null;

  const { months, error: monthsErr } = monthsUntil(body.deliverAt || '');
  if (monthsErr) return NextResponse.json({ error: monthsErr }, { status: 400 });
  if (months < CAPSULE_MIN_MONTHS) {
    return NextResponse.json({ error: `La trasmissione deve essere tra ${CAPSULE_MIN_MONTHS} mesi e 5 anni` }, { status: 400 });
  }
  if (months > CAPSULE_MAX_MONTHS) {
    return NextResponse.json({ error: 'La trasmissione può essere al massimo tra 5 anni' }, { status: 400 });
  }
  const clampedMonths = clampCapsuleMonths(months);

  const isGuest = auth.role === 'guest';
  const recipientType = isGuest ? 'sposi' : 'singolo';

  let deliveryChannel: 'email' | 'whatsapp' | 'app' = 'app';
  let recipientGuestId: string | null = null;
  let recipientEmail: string | null = null;
  let recipientWhatsapp: string | null = null;

  if (isGuest) {
    // Gli invitati inviano SOLO agli sposi, sempre a pagamento.
    recipientGuestId = null;
    recipientEmail = null;
    recipientWhatsapp = null;
  } else {
    recipientGuestId = body.recipientGuestId || null;
    recipientEmail = body.recipientEmail ? body.recipientEmail.trim().slice(0, 120) : null;
    recipientWhatsapp = body.recipientWhatsapp ? body.recipientWhatsapp.trim().slice(0, 30) : null;
    if (!recipientGuestId && !recipientEmail && !recipientWhatsapp) {
      return NextResponse.json({ error: 'Scegli il destinatario: invitato loggato, email o numero WhatsApp' }, { status: 400 });
    }
    if (recipientGuestId) deliveryChannel = 'app';
    else if (recipientEmail) deliveryChannel = 'email';
    else if (recipientWhatsapp) deliveryChannel = 'whatsapp';
  }

  const senderType = isGuest ? 'invitato' : body.senderType === 'sposa' ? 'sposa' : 'sposo';
  const senderName = isGuest
    ? (auth.guestName || 'Invitato')
    : ((body.senderName || '').trim().slice(0, 60) || 'Sposi');

  const { cents, error: priceErr } = computeCapsulePriceCents(clampedMonths);
  if (priceErr) return NextResponse.json({ error: priceErr }, { status: 400 });
  const paymentRequired = capsulePaymentRequired(senderType, clampedMonths);

  const { message: capsule, error: insertErr } = await createCapsuleMessage({
    event_id: eventId,
    sender_type: senderType,
    sender_name: senderName,
    sender_user_id: auth.userId,
    recipient_type: recipientType,
    recipient_name: isGuest ? 'Sposi' : ((body.recipientName || '').trim().slice(0, 60) || undefined),
    message_type: 'video',
    reveal_at: new Date(body.deliverAt!).toISOString(),
    r2_key: body.videoR2Key,
    watermark_phrase: phrase,
    delivery_channel: deliveryChannel,
    recipient_guest_id: recipientGuestId,
    recipient_email: recipientEmail,
    recipient_whatsapp: recipientWhatsapp,
    status: paymentRequired ? 'awaiting_payment' : 'processing',
    payment_required: paymentRequired,
    price_cents: cents,
  });
  if (insertErr || !capsule) return NextResponse.json({ error: insertErr ?? 'Capsula non creata' }, { status: 500 });

  // Pagamento (invitati sempre; sposi oltre 12 mesi): Stripe Checkout a importo calcolato.
  if (paymentRequired) {
    const successUrl = isSafeUrl(body.successUrl || '')
      ? body.successUrl!
      : `${request.nextUrl.origin}/events/${eventId}/capsule?paid=1`;
    const cancelUrl = isSafeUrl(body.cancelUrl || '')
      ? body.cancelUrl!
      : `${request.nextUrl.origin}/events/${eventId}/capsule?cancelled=1`;

    const { order, error: orderErr } = await createOrder({
      event_id: eventId,
      user_id: auth.userId,
      total: cents / 100,
      paymentMethod: 'stripe',
      metadata: { type: 'time_capsule', capsule_id: capsule.id },
    });
    if (orderErr || !order) {
      await updateCapsule(capsule.id, { status: 'failed', last_error: orderErr ?? 'Ordine non creato' });
      return NextResponse.json({ error: orderErr ?? 'Ordine non creato' }, { status: 500 });
    }

    const { url, error: checkoutErr } = await createCapsuleCheckoutSession({
      event_id: eventId,
      from_name: senderName,
      amount: cents / 100,
      capsuleId: capsule.id,
      successUrl,
      cancelUrl,
    });
    if (checkoutErr || !url) {
      await updateCapsule(capsule.id, { status: 'failed', last_error: checkoutErr ?? 'Checkout non creato' });
      return NextResponse.json({ error: checkoutErr ?? 'Checkout non creato' }, { status: 500 });
    }

    await updateCapsule(capsule.id, { order_id: order.id });
    return NextResponse.json({ capsule, paymentRequired, priceCents: cents, checkoutUrl: url }, { status: 201 });
  }

  // Senza pagamento: submit immediato del job watermark (poll nel cron).
  const { event } = await getEventById(eventId);
  const { partner } = await getEventPartner(eventId);
  const branding = await buildCapsuleBranding({
    brand: event?.brand,
    watermarkFont: event?.watermark_font,
    partnerLogoUrl: partner?.logo_url,
    phrase,
  });

  const submit = await submitCapsuleWatermarkJob(capsule.id, body.videoR2Key, branding);
  if (submit.error) {
    await updateCapsule(capsule.id, { status: 'failed', last_error: submit.error });
    return NextResponse.json({ error: submit.error }, { status: 500 });
  }
  const { message: updated } = await updateCapsule(capsule.id, { video_job_id: submit.jobId ?? null });
  return NextResponse.json({ capsule: updated ?? capsule, paymentRequired, priceCents: cents }, { status: 201 });
}

/** GET — lista capsule: sposi vedono tutte; invitati vedono inviate + ricevute (scadute). */
export async function GET(request: NextRequest, { params }: Params) {
  const { id: eventId } = await params;
  const auth = await authorizeCapsuleAccess(eventId);
  if ('error' in auth) return auth.error;

  if (auth.role === 'couple') {
    const { messages, error } = await getCapsuleMessages(eventId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ capsules: messages });
  }

  const sent = await getCapsulesForUser(eventId, auth.userId);
  const received = auth.guestId
    ? await getCapsulesForRecipientGuest(eventId, auth.guestId)
    : { messages: [] };
  if (sent.error) return NextResponse.json({ error: sent.error }, { status: 500 });
  if (received.error) return NextResponse.json({ error: received.error }, { status: 500 });
  return NextResponse.json({ capsules: [...(sent.messages ?? []), ...(received.messages ?? [])] });
}
