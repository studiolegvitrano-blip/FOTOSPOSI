import { NextRequest, NextResponse } from 'next/server';
import { listObjectsByPrefix } from '@fotosposi/r2-storage';
import { createServiceClient } from '@fotosposi/core';

/**
 * FIX 29/07/2026 — Route admin che elenca i file orfani su R2.
 *
 * "Orfano" = oggetto presente su R2 ma non referenziato da:
 *   - media_uploads.r2_key
 *   - media_uploads.original_r2_key
 *   - upload_queue.r2_key (record pending/failed/synced)
 *
 * Per ogni orfano mostra: key, size, last_modified. Default: SOLA LETTURA
 * (niente cancellazione). Per cancellare serve un secondo endpoint separato
 * esplicito (best practice: l'operatore ispeziona la lista prima di decidere).
 *
 * Auth: stesso pattern delle altre admin-one-shot (X-Cron-Secret).
 *
 * Query params:
 *   - prefix: filtra per prefisso (default = tutto). Es. "events/" o "originals/".
 *   - sample: se "1", mostra solo i primi 100 risultati (per ispezione veloce).
 *
 * Output JSON:
 *   {
 *     totalOrphans: number,
 *     totalBytes: number,
 *     prefixes: { events: { count, bytes }, originals: { count, bytes } },
 *     orphans: [{ key, size, lastModified }]  (max 100 se sample=1)
 *   }
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const prefix = url.searchParams.get('prefix') ?? '';
    const sample = url.searchParams.get('sample') === '1';

    // 1) Lista oggetti su R2 sotto il prefisso richiesto
    const { keys: r2Keys, truncated, error: listErr } = await listObjectsByPrefix(prefix);
    if (listErr) {
      return NextResponse.json({ error: listErr }, { status: 500 });
    }

    // 2) Carica TUTTI i r2_key noti al DB. Per evitare memory blow-up su
    // installazioni grandi, paginiamo con .range(0, 9999). In produzione si
    // può salire, ma per il caso tipico (10k foto = ~10MB JSON) 10k è sicuro.
    const supabase = createServiceClient();
    const allR2Keys = new Set<string>();
    const allOriginalKeys = new Set<string>();
    const allUploadQueueKeys = new Set<string>();
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data: rows } = await supabase
        .from('media_uploads')
        .select('r2_key, original_r2_key')
        .not('r2_key', 'is', null)
        .range(from, from + PAGE - 1);
      for (const r of rows ?? []) {
        if (r.r2_key) allR2Keys.add(r.r2_key);
        if (r.original_r2_key) allOriginalKeys.add(r.original_r2_key);
      }
      if (!rows || rows.length < PAGE) break;
      from += PAGE;
    }
    // upload_queue (record pending/failed che hanno una r2_key ma non sono ancora in media_uploads)
    from = 0;
    while (true) {
      const { data: rows } = await supabase
        .from('upload_queue')
        .select('r2_key')
        .not('r2_key', 'is', null)
        .range(from, from + PAGE - 1);
      for (const r of rows ?? []) if (r.r2_key) allUploadQueueKeys.add(r.r2_key);
      if (!rows || rows.length < PAGE) break;
      from += PAGE;
    }

    // 3) Diff: chiavi su R2 che NON sono nel DB
    const orphans = r2Keys.filter((k) => !allR2Keys.has(k) && !allOriginalKeys.has(k) && !allUploadQueueKeys.has(k));

    // 4) Statistiche per prefisso (events/, originals/)
    const stats = {
      events: { count: 0, bytes: 0 },
      originals: { count: 0, bytes: 0 },
      other: { count: 0, bytes: 0 },
    };
    // Per il size stimato serve una HEAD per ogni oggetto (lento).
    // Facciamolo solo se sample=1 (max 100) per non saturare la lambda.
    const sampleKeys = sample ? orphans.slice(0, 100) : [];
    const sampleEntries: { key: string; size: number; lastModified?: string }[] = [];
    if (sample) {
      for (const k of sampleKeys) {
        try {
          const HEAD = await import('@aws-sdk/client-s3').then((m) => m.HeadObjectCommand);
          const S3Client = (await import('@aws-sdk/client-s3')).S3Client;
          const cfg = {
            region: 'auto',
            endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
              accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
              secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
            },
          };
          const client = new S3Client(cfg);
          const res = await client.send(new HEAD({ Bucket: process.env.R2_BUCKET || 'fotosposi-uploads', Key: k }));
          const size = res.ContentLength ?? 0;
          sampleEntries.push({ key: k, size, lastModified: res.LastModified?.toISOString() });
          if (k.startsWith('events/')) stats.events.bytes += size;
          else if (k.startsWith('originals/')) stats.originals.bytes += size;
          else stats.other.bytes += size;
        } catch {
          sampleEntries.push({ key: k, size: 0 });
        }
      }
      stats.events.count = sampleEntries.filter((e) => e.key.startsWith('events/')).length;
      stats.originals.count = sampleEntries.filter((e) => e.key.startsWith('originals/')).length;
      stats.other.count = sampleEntries.filter((e) => !e.key.startsWith('events/') && !e.key.startsWith('originals/')).length;
    }

    return NextResponse.json({
      prefix,
      r2Total: r2Keys.length,
      dbTotal: allR2Keys.size + allOriginalKeys.size,
      truncated,
      totalOrphans: orphans.length,
      sample,
      orphans: sample ? sampleEntries : orphans.slice(0, 100),
      stats: sample ? stats : undefined,
      hint: orphans.length > 0 && !sample
        ? 'Troppi orfani per ispezione completa. Riprova con ?sample=1 per vedere solo i primi 100.'
        : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Errore interno' },
      { status: 500 },
    );
  }
}
