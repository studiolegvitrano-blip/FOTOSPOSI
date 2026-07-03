import { NextRequest, NextResponse } from 'next/server';
import { getBrandConfig } from '@fotosposi/gte';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug') || 'weddingmoments';
  const result = await getBrandConfig(slug);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.config);
}
