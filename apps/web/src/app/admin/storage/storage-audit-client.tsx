'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface AuditItem {
  r2_key: string;
  event_id: string | null;
  couple_name: string | null;
  queue_id: string | null;
  queue_status: string | null;
  queue_retry: number | null;
  queue_created_at: string | null;
  in_r2: boolean;
  in_media: boolean;
  in_drive: boolean;
  source: 'queue' | 'orphan';
}

function CheckYes() { return <span className="text-green-600 font-bold">✓</span>; }
function CrossNo() { return <span className="text-red-500">✗</span>; }

function shortKey(k: string): string {
  // "events/2026_07_30_Agostino_Danila/1786292121992_1000179223.png" → ".../1000179223.png"
  const parts = k.split('/');
  if (parts.length <= 1) return k;
  return '.../' + parts[parts.length - 1];
}

export function StorageAuditClient({ items }: { items: AuditItem[] }) {
  // Stato per il feedback UI delle azioni: per ogni r2_key → 'loading' | 'ok:<msg>' | 'err:<msg>'
  const [feedback, setFeedback] = useState<Record<string, { kind: 'loading' | 'ok' | 'err'; message: string }>>({});

  async function doAction(r2Key: string, action: 'force' | 'delete') {
    if (action === 'delete' && !confirm(`Eliminare definitivamente "${shortKey(r2Key)}" da R2 + upload_queue?\nOperazione irreversibile.`)) {
      return;
    }
    setFeedback((f) => ({ ...f, [r2Key]: { kind: 'loading', message: action === 'force' ? 'Forzo...' : 'Cancello...' } }));
    try {
      const res = await fetch('/api/admin/storage-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, r2_key: r2Key }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setFeedback((f) => ({ ...f, [r2Key]: { kind: 'err', message: json.error ?? `Errore ${res.status}` } }));
      } else {
        setFeedback((f) => ({ ...f, [r2Key]: { kind: 'ok', message: json.message ?? 'OK' } }));
      }
    } catch (e) {
      setFeedback((f) => ({ ...f, [r2Key]: { kind: 'err', message: e instanceof Error ? e.message : 'Errore rete' } }));
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-green-500/50 bg-green-50/30 p-4 text-sm">
        <span className="text-green-700 font-medium">Storage integro ✓</span>
        <span className="text-text-muted"> — nessun pending, fallito o orfano R2 trovato nella scansione.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>r2_key</TableHead>
            <TableHead>Evento</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-center">R2</TableHead>
            <TableHead className="text-center">media</TableHead>
            <TableHead className="text-center">Drive</TableHead>
            <TableHead>Queue</TableHead>
            <TableHead>Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => {
            const fb = feedback[it.r2_key];
            return (
              <TableRow key={it.r2_key + (it.queue_id ?? '')}>
                <TableCell className="font-mono text-xs" title={it.r2_key}>
                  {shortKey(it.r2_key)}
                </TableCell>
                <TableCell className="text-text-muted">{it.couple_name ?? it.event_id?.slice(0, 8) ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={it.source === 'queue' ? 'default' : 'secondary'}>{it.source}</Badge>
                </TableCell>
                <TableCell className="text-center">{it.in_r2 ? <CheckYes /> : <CrossNo />}</TableCell>
                <TableCell className="text-center">{it.in_media ? <CheckYes /> : <CrossNo />}</TableCell>
                <TableCell className="text-center">{it.in_drive ? <CheckYes /> : <CrossNo />}</TableCell>
                <TableCell className="text-xs text-text-muted">
                  {it.queue_status ? `${it.queue_status} (retry ${it.queue_retry ?? 0})` : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={fb?.kind === 'loading'}
                      onClick={() => doAction(it.r2_key, 'force')}
                    >
                      Forza
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={fb?.kind === 'loading'}
                      onClick={() => doAction(it.r2_key, 'delete')}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Cancella
                    </Button>
                    {fb && (
                      <p
                        className={`text-xs ${
                          fb.kind === 'ok' ? 'text-green-600' : fb.kind === 'err' ? 'text-red-600' : 'text-text-muted'
                        }`}
                      >
                        {fb.message}
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-text-muted">
        {items.length} righe. Le azioni <strong>Forza</strong> e <strong>Cancella</strong> richiedono una rifetch manuale
        (pulsante Aggiorna in alto) per vedere lo stato aggiornato.
      </p>
    </div>
  );
}
