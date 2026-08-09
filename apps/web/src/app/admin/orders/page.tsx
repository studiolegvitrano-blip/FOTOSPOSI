import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Order } from '@fotosposi/commerce';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';
import { internalBaseUrl } from '@/lib/internal-base';
import OrdersClient from './orders-client';

export const dynamic = 'force-dynamic';

async function loadData(cookieHeader: string): Promise<{ data?: Order[]; error?: string }> {
  const base = await internalBaseUrl();
  try {
    const res = await fetch(`${base}/api/admin/orders/iban`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.error ?? `Errore ${res.status}` };
    }
    const json = await res.json();
    return { data: (json.orders ?? []) as Order[] };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore rete' };
  }
}

export default async function AdminOrdersPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const token = ceoTokenFromCookies(cookieHeader);

  if (!(await verifyCeoSession(token))) {
    redirect('/ceo/login?redirect=/admin/orders');
  }

  const { data: orders, error } = await loadData(cookieHeader);

  if (error) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <h1 className="text-2xl font-bold">Ordini Bonifico</h1>
        <p className="text-destructive">Errore: {error}</p>
      </main>
    );
  }

  return <OrdersClient initialOrders={orders ?? []} />;
}
