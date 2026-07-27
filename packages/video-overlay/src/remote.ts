// Adapter remoto per l'applicazione del watermark video: POSTa il job a un VPS
// esterno (lo stesso che ospita wa-automate-nodejs per WhatsApp). Il VPS esegue
// ffmpeg di sistema (no bundle 70MB ffmpeg-static, no timeout 60/300s) e può
// processare video di qualsiasi dimensione — wedding ceremony 200MB+, ricevimento
// intero, ecc. Schema di rete riusato dal provider WhatsApp: API key in header,
// body JSON con URL presigned di download e di upload (il VPS non vede mai le
// credenziali R2, lavora solo con URL temporanei firmati).
//
// Protocollo (vedi vps-scripts/video-watermark-server.js):
//   POST {VPS_FFMPEG_URL}/watermark
//   Headers: X-API-Key: {VPS_FFMPEG_API_KEY}
//   Body JSON: {
//     downloadUrl: string,   // presigned R2 GET del video originale
//     uploadUrl: string,     // presigned R2 PUT del watermarkato (sovrascrive)
//     branding: RemoteBranding,
//   }
//   Response 200: { ok: true, bytes: number, durationMs: number }
//   Response 4xx/5xx: { ok: false, error: string }
//
// La route client (`/api/photos/[id]/share`) deve generare entrambi i presigned URL
// e passarli allo adapter: l'adapter NON trasferisce mai i byte del video alla
// lambda (che è il punto). Il VPS scarica → watermarka → uploada direttamente.

// Branding serializzabile via JSON per il VPS. NON importiamo VideoOverlayBranding
// da index.ts per evitare dipendenza circolare (index.ts re-esporta già da qui).
// La route lato Next trasforma `logoPng: Buffer` in `logoBase64` prima di chiamare.
export interface RemoteBranding {
  coupleNames: string;
  date: string;
  primaryColor: string;
  textColor?: string;
  wordmark: string;
  fontFamily?: string;
  logoBase64?: string;
  logoMimeType?: string;
}

export interface RemoteWatermarkRequest {
  downloadUrl: string;
  uploadUrl: string;
  branding: RemoteBranding;
  /** Massima durata accettabile in secondi; se undefined il VPS processa sempre. */
  maxDurationSeconds?: number;
}

export interface RemoteWatermarkResponse {
  ok: boolean;
  bytes?: number;
  durationMs?: number;
  error?: string;
}

export class VpsNotConfiguredError extends Error {
  constructor() {
    super(
      'VPS_FFMPEG_URL non configurata (impostare VPS_FFMPEG_URL + VPS_FFMPEG_API_KEY in Vercel env)',
    );
    this.name = 'VpsNotConfiguredError';
  }
}

function getEnv(name: string): string | undefined {
  if (typeof process === 'undefined') return undefined;
  return (process as { env: Record<string, string | undefined> }).env[name];
}

export function isVpsWatermarkConfigured(): boolean {
  return !!(getEnv('VPS_FFMPEG_URL') && getEnv('VPS_FFMPEG_API_KEY'));
}

/**
 * Manda al VPS il job watermark. L'adapter NON tocca mai i byte del video: tutto
 * il trasferimento avviene lato VPS tramite presigned URL. La lambda ringrazia e
 * basta. Tempo massimo atteso ~30s anche per video 200MB+ (ffmpeg veryfast +
 * scale a 1080).
 *
 * Il timeout interno è 55s (sotto il maxDuration 60s della lambda) per garantire
 * che anche in caso di VPS lento la lambda risponde e il client non veda 504.
 *
 * Throw VpsNotConfiguredError se mancano le env. La route chiamante deve
 * catchare gli errori di rete e fallbackare su applyVideoOverlay (locale).
 */
export async function applyVideoOverlayRemote(
  req: RemoteWatermarkRequest,
): Promise<RemoteWatermarkResponse> {
  const vpsUrl = getEnv('VPS_FFMPEG_URL');
  const apiKey = getEnv('VPS_FFMPEG_API_KEY');
  if (!vpsUrl || !apiKey) throw new VpsNotConfiguredError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000); // 55s, sotto maxDuration lambda 60s
  try {
    const res = await fetch(`${vpsUrl.replace(/\/$/, '')}/watermark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        downloadUrl: req.downloadUrl,
        uploadUrl: req.uploadUrl,
        branding: req.branding,
        maxDurationSeconds: req.maxDurationSeconds,
      }),
      signal: controller.signal,
    });
    const body: RemoteWatermarkResponse = await res
      .json()
      .catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!res.ok || !body.ok) {
      return { ok: false, error: body.error || `VPS watermark failed HTTP ${res.status}` };
    }
    return {
      ok: true,
      bytes: body.bytes,
      durationMs: body.durationMs,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Test isolation hook (simmetria con resetWhatsAppProviderForTests delle notifications)
export function resetVpsWatermarkForTests(): void {
  // niente stato in modulo da pulire: env lette per-request via getEnv.
}
