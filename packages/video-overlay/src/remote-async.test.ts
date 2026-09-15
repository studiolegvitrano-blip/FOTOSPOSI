import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  applyVideoOverlayRemoteAsync,
  getVideoWatermarkJobStatus,
  submitVideoWatermarkJob,
} from './remote';

// Le funzioni leggono VPS_FFMPEG_URL / VPS_FFMPEG_API_KEY con fallback di
// produzione: nei test intercettiamo fetch, quindi l'endpoint non conta.
// Il punto del test e' la MACCHINA A STATI async (submit → poll → resume),
// non la rete.

const ORIG_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIG_FETCH;
  vi.restoreAllMocks();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    return handler(u, init);
  }) as typeof fetch;
  return calls;
}

const req = {
  downloadUrl: 'https://example.com/dl',
  uploadUrl: 'https://example.com/ul',
  branding: { coupleNames: 'A ❤ B', date: '', primaryColor: '#1a1a2e', wordmark: 'Sposi.live' },
};

describe('submitVideoWatermarkJob', () => {
  it('POSTa async:true e ritorna il jobId (202)', async () => {
    const calls = mockFetch((url) => {
      expect(url).toContain('/watermark');
      return jsonResponse(202, { ok: true, jobId: 'j-111' });
    });
    const res = await submitVideoWatermarkJob(req);
    expect(res.ok).toBe(true);
    expect(res.jobId).toBe('j-111');
    expect(calls).toHaveLength(1);
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.async).toBe(true);
    expect((calls[0].init?.headers as Record<string, string>)['X-API-Key']).toBeTruthy();
  });

  it('mappa errori HTTP/server a ok:false senza lanciare', async () => {
    mockFetch(() => jsonResponse(500, { ok: false, error: 'boom' }));
    const res = await submitVideoWatermarkJob(req);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('boom');
  });
});

describe('getVideoWatermarkJobStatus', () => {
  it('ritorna lo status del job', async () => {
    mockFetch((url) => {
      expect(url).toContain('/jobs/j-222');
      return jsonResponse(200, { ok: true, status: 'running' });
    });
    const res = await getVideoWatermarkJobStatus('j-222');
    expect(res.ok).toBe(true);
    expect(res.status).toBe('running');
  });
});

describe('applyVideoOverlayRemoteAsync', () => {
  it('submit → done al primo poll → ok con bytes', async () => {
    mockFetch((url) => {
      if (url.endsWith('/watermark')) return jsonResponse(202, { ok: true, jobId: 'j1' });
      return jsonResponse(200, { ok: true, status: 'done', bytes: 1234, durationMs: 9000 });
    });
    const res = await applyVideoOverlayRemoteAsync(req, { pollBudgetMs: 1000, pollIntervalMs: 1 });
    expect(res).toMatchObject({ ok: true, jobId: 'j1', bytes: 1234 });
    expect(res.inProgress).toBeUndefined();
  });

  it('budget esaurito mentre il job e ancora running → inProgress:true + jobId riusabile', async () => {
    mockFetch((url) => {
      if (url.endsWith('/watermark')) return jsonResponse(202, { ok: true, jobId: 'j2' });
      return jsonResponse(200, { ok: true, status: 'running' });
    });
    const res = await applyVideoOverlayRemoteAsync(req, { pollBudgetMs: 30, pollIntervalMs: 5 });
    expect(res.ok).toBe(false);
    expect(res.inProgress).toBe(true);
    expect(res.jobId).toBe('j2');
  });

  it('status error → ok:false con il messaggio del VPS', async () => {
    mockFetch((url) => {
      if (url.endsWith('/watermark')) return jsonResponse(202, { ok: true, jobId: 'j3' });
      return jsonResponse(200, { ok: true, status: 'error', error: 'ffmpeg esploso' });
    });
    const res = await applyVideoOverlayRemoteAsync(req, { pollBudgetMs: 1000, pollIntervalMs: 1 });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('ffmpeg esploso');
    expect(res.inProgress).toBeUndefined();
  });

  it('resume: jobId esistente → non fa submit, fa solo poll', async () => {
    const calls = mockFetch((url) => {
      if (url.endsWith('/watermark')) throw new Error('non doveva fare submit');
      return jsonResponse(200, { ok: true, status: 'done', bytes: 42 });
    });
    const res = await applyVideoOverlayRemoteAsync(req, { resumeJobId: 'resume-1', pollBudgetMs: 1000, pollIntervalMs: 1 });
    expect(res.ok).toBe(true);
    expect(calls.every((c) => c.url.includes('/jobs/resume-1'))).toBe(true);
  });

  it('resume con not_found (VPS riavviato) → re-submit una volta e completa', async () => {
    let polls = 0;
    const calls = mockFetch((url) => {
      if (url.endsWith('/watermark')) return jsonResponse(202, { ok: true, jobId: 'j5-new' });
      polls++;
      if (url.endsWith('/jobs/resume-old') && polls === 1) return jsonResponse(200, { ok: true, status: 'not_found' });
      return jsonResponse(200, { ok: true, status: 'done', bytes: 7 });
    });
    const res = await applyVideoOverlayRemoteAsync(req, { resumeJobId: 'resume-old', pollBudgetMs: 1000, pollIntervalMs: 1 });
    expect(res.ok).toBe(true);
    expect(res.jobId).toBe('j5-new');
    const submits = calls.filter((c) => c.url.endsWith('/watermark'));
    expect(submits).toHaveLength(1);
  });

  it('submit fallito → ok:false senza jobId', async () => {
    mockFetch(() => jsonResponse(503, { ok: false, error: 'VPS down' }));
    const res = await applyVideoOverlayRemoteAsync(req, { pollBudgetMs: 1000, pollIntervalMs: 1 });
    expect(res.ok).toBe(false);
    expect(res.jobId).toBeUndefined();
  });
});
