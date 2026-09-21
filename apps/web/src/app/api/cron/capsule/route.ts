import { NextRequest, NextResponse } from 'next/server';
import { runCapsuleSweep } from '@fotosposi/time-capsule';
import { getEventById } from '@fotosposi/events';
import { getEventPartner } from '@fotosposi/partner';
import { buildCapsuleBranding } from '@/lib/capsule-watermark';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return authHeader === `Bearer ${secret}`;
}

/**
 * GET /api/cron/capsule — sweep giornaliero Capsula del Tempo:
 * resume job watermark async (resume video_job_id, senza re-encode),
 * re-submit capsule fallite (retry < 3), trasmissione capsule scadute
 * (email Resend con link; WhatsApp pending finché il canale non è attivo).
 * GET-only: POST risponde 405. Trigger manuale = GET + Bearer CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = req.nextUrl.origin;

  // Cache per evento: base branding (logo sposi/partner, font) caricato UNA volta per evento.
  const brandingCache = new Map<string, { brand?: string | null; watermarkFont?: string | null; partnerLogoUrl?: string | null }>();
  const brandingFor = async (capsule: { event_id: string; watermark_phrase?: string | null }) => {
    let base = brandingCache.get(capsule.event_id);
    if (!base) {
      const { event } = await getEventById(capsule.event_id);
      const { partner } = await getEventPartner(capsule.event_id);
      base = {
        brand: event?.brand,
        watermarkFont: event?.watermark_font,
        partnerLogoUrl: partner?.logo_url,
      };
      brandingCache.set(capsule.event_id, base);
    }
    return buildCapsuleBranding({ ...base, phrase: capsule.watermark_phrase });
  };

  const result = await runCapsuleSweep({
    baseUrl,
    brandingFor,
    pollBudgetMs: Number(process.env.VIDEO_POLL_BUDGET_MS) || 150_000,
  });

  return NextResponse.json({ ...result });
}
