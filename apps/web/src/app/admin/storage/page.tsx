import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ceoTokenFromCookies, verifyCeoSession } from '@/lib/ceo-auth';
import { internalBaseUrl } from '@/lib/internal-base';
import { StorageAuditClient } from './storage-audit-client';

export const dynamic = 'force-dynamic';

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

interface AuditPayload {
  items: AuditItem[];
  stats: {
    total: number;
    pending_in_queue: number;
    orphans_r2: number;
    in_media: number;
    in_drive: number;
    r2_truncated: boolean;
  };
  generatedAt: string;
}

async function loadAudit(cookieHeader: string): Promise<{ data?: AuditPayload; error?: string }> {
  const base = await internalBaseUrl();
  try {
    const res = await fetch(`${base}/api/admin/storage-audit`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body?.error ?? `Errore ${res.status}` };
    }
    const json = (await res.json()) as AuditPayload;
    return { data: json };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Errore rete' };
  }
}

export default async function AdminStoragePage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const token = ceoTokenFromCookies(cookieHeader);

  if (!(await verifyCeoSession(token))) {
    redirect('/ceo/login?redirect=/admin/storage');
  }

  const { data, error } = await loadAudit(cookieHeader);

  return (
    <AdminShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnostica storage</h1>
          <p className="text-text-muted text-sm">
            Verifica dove sono finiti i file: coda / R2 / media_uploads / Drive. Generato:{' '}
            {data ? new Date(data.generatedAt).toLocaleString('it-IT') : '—'}
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/admin/storage">Aggiorna</a>
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <Button className="mt-4" variant="outline" asChild>
              <a href="/admin/storage">Riprova</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl text-center text-brand">{data.stats.total}</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-text-muted">Totale righe</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className={`text-3xl text-center ${data.stats.pending_in_queue > 0 ? 'text-amber-500' : 'text-brand'}`}>
                  {data.stats.pending_in_queue}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center text-text-muted">In coda pending</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className={`text-3xl text-center ${data.stats.orphans_r2 > 0 ? 'text-red-600' : 'text-brand'}`}>
                  {data.stats.orphans_r2}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center text-text-muted">Orfani R2</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl text-center text-green-600">{data.stats.in_media}</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-text-muted">In media_uploads</CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl text-center text-green-600">{data.stats.in_drive}</CardTitle>
              </CardHeader>
              <CardContent className="text-center text-text-muted">In Drive</CardContent>
            </Card>
          </div>

          {data.stats.r2_truncated && (
            <Card className="border-amber-500/50 bg-amber-50/30">
              <CardContent className="py-3 text-sm">
                <strong className="text-amber-700">Scan R2 troncato</strong>
                <span className="text-text-muted"> — elenco limitato a 500 oggetti per restare nei 60s di timeout Vercel. Per audit estesi eseguire uno script ad-hoc.</span>
              </CardContent>
            </Card>
          )}

          <StorageAuditClient items={data.items} />

          <Card>
            <CardHeader>
              <CardTitle>Legenda</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-text-muted space-y-1.5">
              <p>
                <Badge variant="outline">queue</Badge> = riga in <code>upload_queue</code> (pending/failed/processing).{' '}
                <strong>Forza</strong>: reset pending, retry_count=0 → il cron maintenance riprocesserà
                (watermark + insert media_uploads + Drive sync).
              </p>
              <p>
                <Badge variant="outline">orphan</Badge> = oggetto in R2 MA senza né riga media né riga in coda.{' '}
                <strong>Forza</strong>: inferisce <code>event_id</code> dal path R2 <code>{'events/<folder>/...'}</code> e crea una nuova riga pending.
                Se l'inferenza fallisce (folder non riconosciuto) la row 400 con messaggio esplicito.
              </p>
              <p>
                <strong>Cancella</strong>: rimuove da <code>upload_queue</code> + DELETE da R2 + log di auditoria in{' '}
                <code>system_health_log.job='storage_audit'</code>. Operazione distruttiva e irreversibile.
              </p>
              <p>
                Colonne <code>in_R2 / in_media / in_drive</code>: ✓ = presente in quello storage. Permettono di capire se il file è
                allo stato intermedio o finale.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </AdminShell>
  );
}
