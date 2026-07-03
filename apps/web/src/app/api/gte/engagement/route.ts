import { NextRequest, NextResponse } from 'next/server';
import { recordEngagement } from '@fotosposi/gte';

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.brand_id || !body.platform || !body.message_text) {
    return NextResponse.json({ error: 'brand_id, platform, message_text required' }, { status: 400 });
  }
  const result = await recordEngagement({
    brand_id: body.brand_id,
    platform: body.platform,
    platform_message_id: body.platform_message_id,
    platform_user_id: body.platform_user_id,
    platform_account_id: body.platform_account_id,
    user_name: body.user_name,
    user_profile_url: body.user_profile_url,
    message_text: body.message_text,
    language: body.language,
    intent: body.intent,
    risk: body.risk,
    confidence: body.confidence,
    needs_review: body.needs_review,
    suggested_auto_reply: body.suggested_auto_reply,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.record);
}
