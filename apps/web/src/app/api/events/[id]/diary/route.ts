import { NextRequest, NextResponse } from 'next/server';
import { createDiaryEntry, getDiaryEntries, getDiarySummary } from '@fotosposi/work-diary';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).at(-2);
  if (!id) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

  const type = req.nextUrl.searchParams.get('type');
  if (type === 'summary') {
    const { summary, error } = await getDiarySummary(id);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ summary });
  }

  const { entries, error } = await getDiaryEntries(id);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const id = req.nextUrl.pathname.split('/').filter(Boolean).at(-2);
  if (!id) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

  const body = await req.json();
  const { entry, error } = await createDiaryEntry({
    event_id: id,
    task: body.task,
    phase: body.phase,
    notes: body.notes,
    financial_link: body.financial_link,
    due_date: body.due_date,
    created_by: body.created_by,
  });
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ entry }, { status: 201 });
}
