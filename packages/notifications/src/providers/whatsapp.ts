// WhatsApp provider strategy — double provider Evolution API + open-wa/wa-automate-nodejs.
//
// Selection rules (evaluated in this order):
//   1. env WHATSAPP_PROVIDER == 'wa-automate'  → use wa-automate adapter (HTTP Easy API)
//   2. env WHATSAPP_PROVIDER == 'evolution'     → use Evolution adapter (HTTP)
//   3. (no env, autodetect): WA_AUTOMATE_URL set  → wa-automate (won the race)
//   4. (no env, no autodetect): EVOLUTION_API_URL set → evolution (legacy default)
//   5. none configured → throw ProviderNotConfigured
//
// Both adapters target an HTTP endpoint that the user runs OUTSIDE Vercel:
//   - wa-automate: `npx @open-wa/wa-automate --port 8080 --api-key K` (self-hosted, persistent)
//   - evolution:   self-hosted Evolution API server (existing setup)
//
// Vercel lambdas banned from running a browser runtime: our adapter is HTTP-only, the open-wa
// runtime lives on a VPS / fly.io / railway. See `WA_AUTOMATE_URL` env below.
//
// Required envs (selected provider only):
//   wa-automate: WA_AUTOMATE_URL (https://vps.example:8080), WA_AUTOMATE_API_KEY
//   evolution:   EVOLUTION_API_URL,                       EVOLUTION_API_KEY

export interface WhatsAppProvider {
  readonly id: 'wa-automate' | 'evolution';
  /** Send a text message. Numbers must be E.164 (e.g. +393334445566 or 393334445566). */
  sendText(params: { to: string; text: string }): Promise<{ ok: boolean; messageId?: string; raw?: unknown; error?: string }>;
  isConfigured(): boolean;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super('WhatsApp provider non configurato. Imposta WHATSAPP_PROVIDER=wa-automate o evolution + le relative URL/KEY env.');
    this.name = 'ProviderNotConfiguredError';
  }
}

// ============================================================================
// Adapter 1: open-wa/wa-automate-nodejs — Easy API (HTTP)
// Docs: https://docs.openwa.dev/APIS/EASY-API
// Endpoint used: POST {base}/sendText  Body: { phone, message }  Auth: `X-API-Key` header
// Multiple granular API variants exist; `sendText` is the smallest contract.
// ============================================================================

class WaAutomateProvider implements WhatsAppProvider {
  readonly id = 'wa-automate' as const;

  private get baseUrl(): string {
    const u = process.env.WA_AUTOMATE_URL ?? '';
    return u.endsWith('/') ? u.slice(0, -1) : u;
  }
  private get apiKey(): string { return process.env.WA_AUTOMATE_API_KEY ?? ''; }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async sendText(params: { to: string; text: string }): ReturnType<WhatsAppProvider['sendText']> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WA_AUTOMATE_URL/WA_AUTOMATE_API_KEY non configurate' };
    }
    // open-wa accepts "phone" as the chatId prefix-free; for clarity we ship the chatId form
    // (e.g. 393334445566 and 393334445566@c.us both work with Easy API → just send the bare number).
    const phone = sanitizePhone(params.to);
    try {
      const res = await fetch(`${this.baseUrl}/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // open-wa Easy API accepts both `X-API-Key` and Bearer. Use X-API-Key for clarity.
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ phone, message: params.text }),
      });
      if (!res.ok) {
        return { ok: false, error: `wa-automate ${res.status}: ${(await safeText(res)).slice(0, 200)}` };
      }
      const data: any = await res.json().catch(() => ({}));
      // Easy API returns a payload like { success: true, id: <messageId>, ... } or the raw WA call envelope.
      return { ok: true, messageId: data?.id ?? data?.messageId, raw: data };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }
}

// ============================================================================
// Adapter 2: Evolution API (legacy default) — kept for continuity.
// Endpoint: POST {base}/message/send Body: { number, text } Auth: `Bearer ${key}`
// ============================================================================

class EvolutionProvider implements WhatsAppProvider {
  readonly id = 'evolution' as const;

  private get baseUrl(): string {
    const u = process.env.EVOLUTION_API_URL ?? '';
    return u.endsWith('/') ? u.slice(0, -1) : u;
  }
  private get apiKey(): string { return process.env.EVOLUTION_API_KEY ?? ''; }

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.apiKey);
  }

  async sendText(params: { to: string; text: string }): ReturnType<WhatsAppProvider['sendText']> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'EVOLUTION_API_URL/EVOLUTION_API_KEY non configurate' };
    }
    const number = sanitizePhone(params.to);
    try {
      const res = await fetch(`${this.baseUrl}/message/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ number, text: params.text }),
      });
      if (!res.ok) {
        return { ok: false, error: `evolution ${res.status}: ${(await safeText(res)).slice(0, 200)}` };
      }
      const data: any = await res.json().catch(() => ({}));
      return { ok: true, messageId: data?.id ?? data?.messageId, raw: data };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function sanitizePhone(input: string): string {
  // Strip everything except digits, "AMbiguous" leading + is removed for E.164 BARE form.
  return (input ?? '').replace(/[^\d]/g, '').replace(/^0+/, '');
}

async function safeText(res: Response): Promise<string> {
  try { return await res.text(); } catch { return ''; }
}

// ============================================================================
// Selector — memoized at first call so subsequent messages reuse the same instance.
// ============================================================================

let cached: WhatsAppProvider | null = null;

export function selectWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;

  const explicit = (process.env.WHATSAPP_PROVIDER ?? '').toLowerCase();
  if (explicit === 'wa-automate') return cached = new WaAutomateProvider();
  if (explicit === 'evolution')  return cached = new EvolutionProvider();

  // autodetect: prefer wa-automate URL if present, else evolution (legacy), else throw.
  const wa = new WaAutomateProvider();
  if (wa.isConfigured()) return cached = wa;
  const ev = new EvolutionProvider();
  if (ev.isConfigured()) return cached = ev;

  throw new ProviderNotConfiguredError();
}

export function resetWhatsAppProviderForTests(): void {
  cached = null;
}
