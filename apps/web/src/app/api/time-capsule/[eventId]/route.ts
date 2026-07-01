import { NextRequest, NextResponse } from 'next/server';
import { createCapsuleMessage, getCapsuleMessages, syncCapsuleToDrive, getDueCapsuleMessages, markDelivered, markDownloaded, trashOnDrive } from '@fotosposi/time-capsule';

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.pathname.split('/').filter(Boolean).at(-1);
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
  const recipientType = req.nextUrl.searchParams.get('recipientType') || undefined;
  const { messages, error } = await getCapsuleMessages(eventId, recipientType);
  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const eventId = req.nextUrl.pathname.split('/').filter(Boolean).at(-1);
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

  const body = await req.json();
  const action = body.action;

  if (action === 'sync') {
    const { messageId } = body;
    if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    const result = await syncCapsuleToDrive(messageId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ fileId: result.fileId });
  }

  if (action === 'deliver') {
    const { messageId } = body;
    if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    const { error } = await markDelivered(messageId);
    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'confirm-download') {
    const { messageId } = body;
    if (!messageId) return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    const { error } = await markDownloaded(messageId);
    if (error) return NextResponse.json({ error }, { status: 500 });

    const trashResult = await trashOnDrive(messageId);
    if (trashResult.error) return NextResponse.json({ error: trashResult.error }, { status: 500 });

    return NextResponse.json({ ok: true });
  }

  if (action === 'cron-deliver') {
    const { messages } = await getDueCapsuleMessages();
    for (const msg of messages || []) {
      await markDelivered(msg.id);
    }
    return NextResponse.json({ delivered: messages?.length || 0 });
  }

  const { message, error } = await createCapsuleMessage({
    event_id: eventId,
    sender_type: body.sender_type,
    sender_name: body.sender_name,
    sender_user_id: body.sender_user_id,
    recipient_type: body.recipient_type,
    recipient_name: body.recipient_name,
    recipient_group: body.recipient_group,
    message_type: body.message_type,
    content: body.content,
    file_url: body.file_url,
    storage_path: body.storage_path,
    reveal_at: body.reveal_at,
  });

  if (error) return NextResponse.json({ error }, { status: 500 });
  return NextResponse.json({ message }, { status: 201 });
}
