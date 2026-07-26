import { createServiceClient } from '@fotosposi/core';
import { selectWhatsAppProvider, ProviderNotConfiguredError } from './providers/whatsapp';

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

  let status = 'pending';
  let errorMsg: string | null = null;

  // Email-specific: Resend is the only email provider. Bail out fast if missing.
  if (params.channel === 'email' && !process.env.RESEND_API_KEY) {
    status = 'failed';
    errorMsg = 'RESEND_API_KEY non configurata';
  }

  if (status === 'pending' && params.channel === 'email') {
    try {
      const { data: event } = await supabase.from('events').select('brand').eq('id', params.event_id).single();
      const fromAddress = event?.brand === 'weddingmoments' ? 'info@justmarry.live' : 'info@sposi.live';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromAddress, to: params.recipient, subject: params.subject, text: params.body }),
      });
      if (!res.ok) { status = 'failed'; errorMsg = `Email error: ${res.statusText}`; }
      else status = 'sent';
    } catch (e: any) { status = 'failed'; errorMsg = e.message; }
  }

  if (status === 'pending' && params.channel === 'whatsapp') {
    try {
      const provider = selectWhatsAppProvider();
      const result = await provider.sendText({ to: params.recipient, text: params.body ?? '' });
      if (result.ok) {
        status = 'sent';
      } else {
        status = 'failed';
        errorMsg = `WhatsApp (${provider.id}): ${result.error ?? 'errore sconosciuto'}`;
      }
    } catch (e: any) {
      status = 'failed';
      // ProviderNotConfiguredError or any unexpected runtime error
      errorMsg = e instanceof ProviderNotConfiguredError
        ? 'WhatsApp provider non configurato (impostare WHATSAPP_PROVIDER=wa-automate|evolution + URL/KEY)'
        : (e?.message ?? String(e));
    }
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
