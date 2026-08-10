import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Affiliate } from '@fotosposi/commerce';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';
import { internalBaseUrl } from '@/lib/internal-base';
import { AdminShell } from '@/components/admin/AdminShell';
import AffiliatesClient from './affiliates-client';

export const dynamic = 'force-dynamic';

async function loadData(cookieHeader: string): Promise<{ data?: Affiliate[]; error?: string }> {
  const base = await internalBaseUrl();
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

  if (!(await verifyCeoSession(token))) {
    redirect('/ceo/login?redirect=/admin/affiliates');
  }

  const { data: affiliates, error } = await loadData(cookieHeader);

  if (error) {
    return (
      <AdminShell>
        <h1 className="text-2xl font-bold">Collaboratori & Affiliati</h1>
        <p className="text-destructive">Errore: {error}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AffiliatesClient initialAffiliates={affiliates ?? []} />
    </AdminShell>
  );
}
