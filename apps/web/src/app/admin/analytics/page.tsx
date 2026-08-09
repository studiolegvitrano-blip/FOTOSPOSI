import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';
import AnalyticsClient from './analytics-client';

export const dynamic = 'force-dynamic';

interface AnalyticsPayload {
  data: any;
  activation: any;
  engagement: any[];
  viral: any;
  b2b: any;
}

async function loadData(cookieHeader: string): Promise<{ data?: AnalyticsPayload; error?: string }> {
  const base = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/admin/analytics`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.error ?? `Errore ${res.status}` };
    }
    const json = (await res.json()) as AnalyticsPayload;
    return { data: json };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore rete' };
  }
}

export default async function AdminAnalyticsPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const token = ceoTokenFromCookies(cookieHeader);

  if (!(await verifyCeoSession(token))) {
    redirect('/ceo/login?redirect=/admin/analytics');
  }

  const { data: payload, error } = await loadData(cookieHeader);

  if (error || !payload) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-destructive">Errore: {error ?? 'dati non disponibili'}</p>
      </main>
    );
  }

  return (
    <AnalyticsClient
      data={payload.data}
      activation={payload.activation}
      engagement={payload.engagement ?? []}
      viral={payload.viral}
      b2b={payload.b2b}
    />
  );
}
