'use client';

import { useState } from 'react';
import type { Order } from '@fotosposi/commerce';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  initialOrders: Order[];
}

function metaLabel(meta: Record<string, unknown> | null): string {
  if (!meta) return '—';
  if (meta.kind === 'partner_package') {
    return `Pacchetto partner: ${String(meta.tier ?? '')} × ${String(meta.quantity ?? '')} licenze`;
  }
  return JSON.stringify(meta);
}

export default function OrdersClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const act = async (order: Order, action: 'confirm' | 'cancel') => {
    setBusy(order.id);
    setMsg('');
    try {
      const res = await fetch('/api/admin/orders/iban', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, action }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Errore');
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      if (action === 'confirm' && json.generatedCodes) {
        setMsg(`Bonifico confermato: ${json.generatedCodes} codici partner generati.`);
      } else if (action === 'confirm' && json.warning) {
        setMsg(json.warning);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ordini Bonifico</h1>
        <a href="/admin" className="text-sm text-brand hover:underline">← Dashboard</a>
      </div>

      {msg && <p className="text-sm text-success">{msg}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">In attesa di bonifico ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-text-muted">Nessun ordine in attesa.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creato</TableHead>
                  <TableHead>Causale</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Dettaglio</TableHead>
                  <TableHead>Importo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString('it-IT')}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{o.payment_reference ?? '—'}</code>
                    </TableCell>
                    <TableCell className="text-xs">{o.event_id?.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">{metaLabel(o.metadata)}</TableCell>
                    <TableCell className="font-medium">{(o.total / 100).toFixed(2)} €</TableCell>
                    <TableCell><Badge variant="secondary">pending</Badge></TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="default" onClick={() => act(o, 'confirm')} disabled={busy === o.id}>
                        Conferma
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => act(o, 'cancel')} disabled={busy === o.id}>
                        Annulla
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
