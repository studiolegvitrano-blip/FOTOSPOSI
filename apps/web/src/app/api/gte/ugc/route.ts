import { NextRequest, NextResponse } from 'next/server';
import { getUGCForPipeline } from '@fotosposi/gte';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const since = searchParams.get('since') || undefined;
  const result = await getUGCForPipeline({ limit, since });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.ugc, count: result.ugc?.length ?? 0 });
}
