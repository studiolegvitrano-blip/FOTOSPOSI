import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';

export const dynamic = 'force-dynamic';

interface SystemPayload {
  queue: Record<string, number>;
  queueTotal: number;
  deadLetter: {
    total: number;
    byClass: Record<string, number>;
    recent: Array<{ id: string; file_name?: string | null; last_failure_class?: string | null; dlq_retry_count?: number; moved_to_dlq_at?: string }>;
    unrecoverable: number;
  };
  watermarkMissing: number;
  failures: {
    total: number;
    byClass: Record<string, number>;
    byEvent: Record<string, number>;
    byFile: Record<string, number>;
    topEvents: Array<{ eventId: string; coupleName: string; count: number }>;
    recent: Array<{ event_id?: string | null; file_name?: string | null; failure_class?: string | null; error_message?: string | null; retry_count?: number; created_at?: string }>;
  };
  lastJobs: Record<string, { status: string; created_at: string; details?: unknown } | null>;
  generatedAt: string;
}

const FAILURE_CLASS_LABELS: Record<string, string> = {
  r2_download_failed: 'Download R2',
  watermark_apply_failed: 'Watermark',
  drive_sync_failed: 'Sync Drive',
  detect_watermark_missing: 'Watermark mancante',
  invalid_image: 'Immagine non valida',
  other: 'Altro',
};

const JOB_LABELS: Record<string, string> = {
  backup: 'Backup',
  maintenance: 'Manutenzione',
  'dlq-retry': 'DLQ retry',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'ok' ? 'default' : status === 'warning' ? 'secondary' : 'destructive';
  return <Badge variant={variant as any}>{status}</Badge>;
}

async function loadSystemData(cookieHeader: string): Promise<{ data?: SystemPayload; error?: string }> {
  const base = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/admin/system`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.error ?? `Errore ${res.status}` };
    }
    const json = (await res.json()) as SystemPayload;
    return { data: json };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore rete' };
  }
}

export default async function AdminSystemPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const token = ceoTokenFromCookies(cookieHeader);

  if (!(await verifyCeoSession(token))) {
    redirect('/ceo/login?redirect=/admin/system');
  }

  const { data, error } = await loadSystemData(cookieHeader);

  if (error) {
    return (
      <main className="max-w-5xl mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Stato di sistema</h1>
          <Button variant="outline" asChild><Link href="/admin">Admin</Link></Button>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <Button className="mt-4" variant="outline" asChild><Link href="/admin/system">Riprova</Link></Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const pending = data?.queue?.pending ?? 0;
  const processing = data?.queue?.processing ?? 0;
  const failed = data?.queue?.failed ?? 0;
  const synced = data?.queue?.synced ?? 0;
  const dlqTotal = data?.deadLetter?.total ?? 0;
  const dlqUnrecoverable = data?.deadLetter?.unrecoverable ?? 0;
  const dlqRecoverable = dlqTotal - dlqUnrecoverable;
  const watermarkMissing = data?.watermarkMissing ?? 0;
  const failureTotal = data?.failures?.total ?? 0;
  const generatedAt = data?.generatedAt ? formatDate(data.generatedAt) : '—';

  return (
    <main className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stato di sistema</h1>
          <p className="text-text-muted text-sm">
            Telemetry, code di processing e cron. Generato: {generatedAt}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/admin/system">Aggiorna</Link></Button>
          <Button variant="outline" asChild><Link href="/admin">Admin</Link></Button>
          <form action="/api/ceo/logout" method="POST" style={{ display: 'inline' }}>
            <Button type="submit" variant="ghost">Esci</Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardHeader><CardTitle className={`text-3xl text-center ${pending > 0 ? 'text-amber-500' : 'text-brand'}`}>{pending}</CardTitle></CardHeader><CardContent className="text-center text-text-muted">In coda</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-3xl text-center text-brand">{processing}</CardTitle></CardHeader><CardContent className="text-center text-text-muted">In elaborazione</CardContent></Card>
        <Card><CardHeader><CardTitle className={`text-3xl text-center ${failed > 0 ? 'text-red-600' : 'text-brand'}`}>{failed}</CardTitle></CardHeader><CardContent className="text-center text-text-muted">Falliti (in retry)</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-3xl text-center text-green-600">{synced}</CardTitle></CardHeader><CardContent className="text-center text-text-muted">Completati</CardContent></Card>
        <Card><CardHeader><CardTitle className={`text-3xl text-center ${dlqTotal > 0 ? 'text-red-600' : 'text-brand'}`}>{dlqTotal}</CardTitle></CardHeader><CardContent className="text-center text-text-muted">Dead letter</CardContent></Card>
        <Card><CardHeader><CardTitle className={`text-3xl text-center ${watermarkMissing > 0 ? 'text-amber-500' : 'text-brand'}`}>{watermarkMissing}</CardTitle></CardHeader><CardContent className="text-center text-text-muted">Foto no watermark</CardContent></Card>
      </div>

      {dlqUnrecoverable > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/30">
          <CardContent className="py-3 text-sm">
            <strong className="text-amber-700">{dlqUnrecoverable} item in DLQ non recuperabili</strong>
            <span className="text-text-muted"> (r2_key mancante: il file non è mai arrivato su R2). Il cron dlq-retry li skippa automaticamente. Su {dlqTotal} totali DLQ, {dlqRecoverable} sono ancora in retry.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Ultime esecuzioni cron</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Ultima esecuzione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data?.lastJobs ?? {}).map(([job, row]) => (
                  <TableRow key={job}>
                    <TableCell className="font-medium">{JOB_LABELS[job] ?? job}</TableCell>
                    <TableCell>{row ? <StatusBadge status={row.status} /> : <Badge variant="outline">mai eseguito</Badge>}</TableCell>
                    <TableCell className="text-text-muted">{row ? formatDate(row.created_at) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-3 text-xs text-text-muted">
              {data?.lastJobs?.backup?.status === 'error' && (
                <p className="text-red-600">⚠ Il backup notturno fallisce: verificare i log Vercel (backup route).</p>
              )}
              {data?.lastJobs?.maintenance?.status === 'error' && (
                <p className="text-red-600">⚠ La manutenzione notturna fallisce: verificare i log Vercel.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fallimenti processing — ultimi 7 giorni</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-4xl font-bold text-brand">{failureTotal}</span>
              <span className="text-text-muted text-sm">totali ({Object.keys(data?.failures?.byClass ?? {}).length} classi)</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">N</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(data?.failures?.byClass ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .map(([cls, n]) => (
                    <TableRow key={cls}>
                      <TableCell className="font-medium">{FAILURE_CLASS_LABELS[cls] ?? cls}</TableCell>
                      <TableCell className="text-right">{n}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Eventi con più fallimenti</CardTitle></CardHeader>
          <CardContent>
            {(data?.failures?.topEvents ?? []).length === 0 ? (
              <p className="text-text-muted text-sm">Nessun fallimento negli ultimi 7 giorni.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead className="text-right">Fallimenti</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data!.failures.topEvents.map((e) => (
                    <TableRow key={e.eventId}>
                      <TableCell className="font-medium">
                        <Link href={`/events/${e.eventId}`} className="hover:underline">{e.coupleName}</Link>
                      </TableCell>
                      <TableCell className="text-right">{e.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Dead letter queue</CardTitle></CardHeader>
          <CardContent>
            {dlqTotal === 0 ? (
              <p className="text-text-muted text-sm">Nessun item in dead letter. Il sistema sta processando in modo pulito.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Object.entries(data?.deadLetter?.byClass ?? {}).map(([cls, n]) => (
                    <Badge key={cls} variant="secondary">{FAILURE_CLASS_LABELS[cls] ?? cls}: {n}</Badge>
                  ))}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Classe</TableHead>
                      <TableHead>Retry DLQ</TableHead>
                      <TableHead>Messo in DLQ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.deadLetter?.recent ?? []).map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="max-w-[220px] truncate">{d.file_name ?? '—'}</TableCell>
                        <TableCell><Badge variant="outline">{FAILURE_CLASS_LABELS[d.last_failure_class ?? 'other'] ?? d.last_failure_class}</Badge></TableCell>
                        <TableCell>{d.dlq_retry_count ?? 0}</TableCell>
                        <TableCell className="text-text-muted">{formatDate(d.moved_to_dlq_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Fallimenti recenti (dettaglio)</CardTitle></CardHeader>
        <CardContent>
          {(data?.failures?.recent ?? []).length === 0 ? (
            <p className="text-text-muted text-sm">Nessun fallimento registrato negli ultimi 7 giorni.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Classe</TableHead>
                  <TableHead>Retry</TableHead>
                  <TableHead>Errore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.failures.recent.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap text-text-muted">{formatDate(f.created_at)}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{f.event_id ?? '—'}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{f.file_name ?? '—'}</TableCell>
                    <TableCell><Badge variant="outline">{FAILURE_CLASS_LABELS[f.failure_class ?? 'other'] ?? f.failure_class}</Badge></TableCell>
                    <TableCell>{f.retry_count ?? 0}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-text-muted" title={f.error_message ?? ''}>{f.error_message ?? '—'}</TableCell>
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
