export type NotificationChannel = 'email' | 'whatsapp';

export interface Notification {
  id: string;
  event_id: string;
  to: string;
  channel: NotificationChannel;
  subject: string;
  body: string;
  sent_at: string | null;
  created_at: string;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  apiKey: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'no-reply@fotosposi.it',
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
