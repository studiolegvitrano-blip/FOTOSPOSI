import { NextRequest, NextResponse } from 'next/server';
import { getB2BLeads, updateLeadStatus } from '@fotosposi/gte';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const category = searchParams.get('category') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100');
  const result = await getB2BLeads({ status, category, limit });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ data: result.leads, count: result.leads?.length ?? 0 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  if (!body.id || !body.status) {
    return NextResponse.json({ error: 'id and status required' }, { status: 400 });
  }
  const result = await updateLeadStatus(body.id, body.status, body.notes);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result.lead);
}
