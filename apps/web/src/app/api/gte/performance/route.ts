import { NextRequest, NextResponse } from 'next/server';
import { recordPerformance } from '@fotosposi/gte';

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.brand_id || !body.platform) {
    return NextResponse.json({ error: 'brand_id and platform required' }, { status: 400 });
  }
  const result = await recordPerformance({
    brand_id: body.brand_id,
    content_id: body.content_id,
    platform: body.platform,
    impressions: body.impressions,
    engagements: body.engagements,
    engagement_rate: body.engagement_rate,
    clicks: body.clicks,
    conversions: body.conversions,
    revenue: body.revenue,
    metadata: body.metadata,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.record);
}
