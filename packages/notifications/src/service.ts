import { createServiceClient } from '@fotosposi/core';

export interface NotificationPreference {
  id: string;
  event_id: string;
  channel: 'email' | 'whatsapp' | 'push';
  enabled: boolean;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  event_id: string;
  channel: string;
  recipient: string;
  subject: string | null;
  body: string | null;
  status: 'pending' | 'sent' | 'failed';
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

export async function getPreferences(eventId: string): Promise<{ prefs?: NotificationPreference[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('notification_preferences').select('*').eq('event_id', eventId);
  if (error) return { error: error.message };
  return { prefs: data ?? [] };
}

export async function updatePreference(eventId: string, channel: string, enabled: boolean): Promise<{ error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase.from('notification_preferences').upsert(
    { event_id: eventId, channel, enabled },
    { onConflict: 'event_id,channel' }
  );
  if (error) return { error: error.message };
  return {};
}

export async function sendNotification(params: {
  event_id: string;
  channel: string;
  recipient: string;
  subject?: string;
  body?: string;
}): Promise<{ log?: NotificationLog; error?: string }> {
  const supabase = createServiceClient();
  const channelKey = process.env[`${params.channel.toUpperCase()}_API_KEY`] || process.env.RESEND_API_KEY;

  let status = 'pending';
  let errorMsg: string | null = null;

  if (!channelKey) {
    status = 'failed';
    errorMsg = `${params.channel.toUpperCase()}_API_KEY non configurata`;
  }

  if (status === 'pending' && params.channel === 'email') {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${channelKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'noreply@fotosposi.it', to: params.recipient, subject: params.subject, text: params.body }),
      });
      if (!res.ok) { status = 'failed'; errorMsg = `Email error: ${res.statusText}`; }
      else status = 'sent';
    } catch (e: any) { status = 'failed'; errorMsg = e.message; }
  }

  if (status === 'pending' && params.channel === 'whatsapp') {
    try {
      const evoUrl = process.env.EVOLUTION_API_URL;
      const evoKey = process.env.EVOLUTION_API_KEY;
      if (evoUrl && evoKey) {
        await fetch(`${evoUrl}/message/send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${evoKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: params.recipient, text: params.body }),
        });
        status = 'sent';
      } else { status = 'failed'; errorMsg = 'Evolution API non configurata'; }
    } catch (e: any) { status = 'failed'; errorMsg = e.message; }
  }

  const { data, error } = await supabase.from('notification_log').insert({
    event_id: params.event_id,
    channel: params.channel,
    recipient: params.recipient,
    subject: params.subject,
    body: params.body,
    status,
    error: errorMsg,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  }).select().single();

  if (error) return { error: error.message };
  return { log: data };
}

export async function getNotificationLog(eventId: string): Promise<{ logs?: NotificationLog[]; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from('notification_log').select('*').eq('event_id', eventId).order('created_at', { ascending: false }).limit(50);
  if (error) return { error: error.message };
  return { logs: data ?? [] };
}
