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
  /** Bytes del TTF selezionato dagli sposi, base64. Il VPS lo embedda via
   *  @font-face nell'SVG del watermark (stesso meccanismo di photo-overlay).
   *  Se assente, il VPS usa il family testuale risolvibile via fontconfig. */
  fontBase64?: string;
  logoBase64?: string;
  logoMimeType?: string;
  /** Logo partner white label (B2B): base64 PNG, compositato in alto a sinistra. */
  partnerLogoBase64?: string;
  partnerLogoMimeType?: string;
}

export interface RemoteWatermarkRequest {
  downloadUrl: string;
  uploadUrl: string;
  branding: RemoteBranding;
  /** Massima durata accettabile in secondi; se undefined il VPS processa sempre. */
  maxDurationSeconds?: number;
  /** Timeout client per la chiamata HTTP al VPS (ms). Default 55s. Le route con
   *  maxDuration lambda maggiore (es. repair, 300s) devono passare un valore più
   *  alto (es. 250s) per video lunghi il cui encode VPS supera i 55s. */
  timeoutMs?: number;
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

/**
 * Fallback costanti per la VPS watermark. Usate SOLO se le env vars
 * VPS_FFMPEG_URL / VPS_FFMPEG_API_KEY non sono visibili nel runtime
 * (problema propagazione env su Vercel serverless). L'URL è pubblico
 * (https://watermark.sposi.live, certificato Let's Encrypt), la key
 * è già documentata in vps-scripts/README.md e in setup-oracle.sh.
 * Le env vars, quando presenti, hanno PRECEDENZA su questi fallback.
 */
const FALLBACK_VPS_URL = 'https://watermark.sposi.live';
const FALLBACK_VPS_KEY = '23836250716cd2459b62fe65f7d7f517640e0b37857253fbefe1f0f48255c977';

function getVpsUrl(): string {
  return getEnv('VPS_FFMPEG_URL') || FALLBACK_VPS_URL;
}

function getVpsKey(): string {
  return getEnv('VPS_FFMPEG_API_KEY') || FALLBACK_VPS_KEY;
}

export function isVpsWatermarkConfigured(): boolean {
  return !!(getVpsUrl() && getVpsKey());
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
  const vpsUrl = getVpsUrl();
  const apiKey = getVpsKey();
  if (!vpsUrl || !apiKey) throw new VpsNotConfiguredError();

  const timeoutMs = req.timeoutMs ?? 55_000; // default sotto il maxDuration 60s della share lambda
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
