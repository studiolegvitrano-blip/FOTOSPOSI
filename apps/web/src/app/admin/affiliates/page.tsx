import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Affiliate } from '@fotosposi/commerce';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';
import AffiliatesClient from './affiliates-client';

export const dynamic = 'force-dynamic';

async function loadData(cookieHeader: string): Promise<{ data?: Affiliate[]; error?: string }> {
  const base = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/admin/affiliates`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.error ?? `Errore ${res.status}` };
    }
    const json = await res.json();
    return { data: (json.data ?? []) as Affiliate[] };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore rete' };
  }
}

export default async function AdminAffiliatesPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const token = ceoTokenFromCookies(cookieHeader);

  if (!verifyCeoSession(token)) {
    redirect('/ceo/login?redirect=/admin/affiliates');
  }

  const { data: affiliates, error } = await loadData(cookieHeader);

  if (error) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold">Collaboratori & Affiliati</h1>
        <p className="text-destructive">Errore: {error}</p>
      </main>
    );
  }

  return <AffiliatesClient initialAffiliates={affiliates ?? []} />;
}
