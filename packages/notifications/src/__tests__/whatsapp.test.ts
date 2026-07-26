import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  selectWhatsAppProvider,
  resetWhatsAppProviderForTests,
  ProviderNotConfiguredError,
} from '../providers/whatsapp';

const ORIG_ENV = { ...process.env };

function setEnv(map: Record<string, string | undefined>) {
  for (const k of Object.keys(map)) {
    if (map[k] === undefined) delete process.env[k];
    else process.env[k] = map[k];
  }
}

describe('whatsapp provider selector', () => {
  beforeEach(() => {
    resetWhatsAppProviderForTests();
    // strip any provider-related env to guarantee deterministic ordering
    delete process.env.WHATSAPP_PROVIDER;
    delete process.env.WA_AUTOMATE_URL;
    delete process.env.WA_AUTOMATE_API_KEY;
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
  });

  afterEach(() => {
    resetWhatsAppProviderForTests();
    setEnv(ORIG_ENV);
  });

  it('throws when no provider is configured', () => {
    expect(() => selectWhatsAppProvider()).toThrowError(ProviderNotConfiguredError);
  });

  it('uses wa-automate by explicit WHATSAPP_PROVIDER', () => {
    setEnv({ WHATSAPP_PROVIDER: 'wa-automate', WA_AUTOMATE_URL: 'http://x', WA_AUTOMATE_API_KEY: 'k' });
    expect(selectWhatsAppProvider().id).toBe('wa-automate');
  });

  it('uses evolution by explicit WHATSAPP_PROVIDER', () => {
    setEnv({ WHATSAPP_PROVIDER: 'evolution', EVOLUTION_API_URL: 'http://y', EVOLUTION_API_KEY: 'k' });
    expect(selectWhatsAppProvider().id).toBe('evolution');
  });

  it('autodetect: prefers wa-automate when both URLs are present', () => {
    setEnv({
      WA_AUTOMATE_URL: 'http://x', WA_AUTOMATE_API_KEY: 'k',
      EVOLUTION_API_URL: 'http://y', EVOLUTION_API_KEY: 'k',
    });
    expect(selectWhatsAppProvider().id).toBe('wa-automate');
  });

  it('autodetect: falls back to evolution when only evolution is configured', () => {
    setEnv({ EVOLUTION_API_URL: 'http://y', EVOLUTION_API_KEY: 'k' });
    expect(selectWhatsAppProvider().id).toBe('evolution');
  });

  it('autodetect: falls back to wa-automate when only wa-automate is configured', () => {
    setEnv({ WA_AUTOMATE_URL: 'http://x', WA_AUTOMATE_API_KEY: 'k' });
    expect(selectWhatsAppProvider().id).toBe('wa-automate');
  });

  it('memoizes: repeated calls return same instance', () => {
    setEnv({ WHATSAPP_PROVIDER: 'wa-automate', WA_AUTOMATE_URL: 'http://x', WA_AUTOMATE_API_KEY: 'k' });
    const a = selectWhatsAppProvider();
    const b = selectWhatsAppProvider();
    expect(a).toBe(b);
  });

  it('respects override after reset', () => {
    setEnv({ WHATSAPP_PROVIDER: 'evolution', EVOLUTION_API_URL: 'http://y', EVOLUTION_API_KEY: 'k' });
    expect(selectWhatsAppProvider().id).toBe('evolution');
    resetWhatsAppProviderForTests();
    setEnv({ WHATSAPP_PROVIDER: 'wa-automate', WA_AUTOMATE_URL: 'http://z', WA_AUTOMATE_API_KEY: 'k' });
    expect(selectWhatsAppProvider().id).toBe('wa-automate');
  });
});

describe('whatsapp adapter behaviours', () => {
  beforeEach(() => {
    resetWhatsAppProviderForTests();
    delete process.env.WHATSAPP_PROVIDER;
    delete process.env.WA_AUTOMATE_URL;
    delete process.env.WA_AUTOMATE_API_KEY;
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
  });
  afterEach(() => {
    resetWhatsAppProviderForTests();
    setEnv(ORIG_ENV);
    vi.restoreAllMocks();
  });

  it('wa-automate: returns ok=false when missing URL', async () => {
    setEnv({ WHATSAPP_PROVIDER: 'wa-automate', WA_AUTOMATE_API_KEY: 'k' });
    const p = selectWhatsAppProvider();
    const r = await p.sendText({ to: '+393334445566', text: 'ciao' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/WA_AUTOMATE_URL/);
  });

  it('wa-automate: POSTs to /sendText with X-API-Key, phone (digits only) and message', async () => {
    setEnv({ WHATSAPP_PROVIDER: 'wa-automate', WA_AUTOMATE_URL: 'http://localhost:8080', WA_AUTOMATE_API_KEY: 'secret' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, id: 'msg_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const p = selectWhatsAppProvider();
    const r = await p.sendText({ to: '+39 333 444 5566', text: 'ciao da Sposi' });
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe('msg_1');
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('http://localhost:8080/sendText');
    expect(init?.method).toBe('POST');
    const headers = (init?.headers as Record<string, string>) ?? {};
    expect(headers['X-API-Key']).toBe('secret');
    const body = JSON.parse((init as any).body as string);
    expect(body.phone).toBe('393334445566'); // plus, spaces, all stripped
    expect(body.message).toBe('ciao da Sposi');
  });

  it('wa-automate: 500 → ok=false with non-empty error', async () => {
    setEnv({ WHATSAPP_PROVIDER: 'wa-automate', WA_AUTOMATE_URL: 'http://localhost:8080', WA_AUTOMATE_API_KEY: 'secret' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );
    const p = selectWhatsAppProvider();
    const r = await p.sendText({ to: '393334445566', text: 'ciao' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/wa-automate 500/);
  });

  it('evolution: POSTs to /message/send with Bearer auth and { number, text }', async () => {
    setEnv({ WHATSAPP_PROVIDER: 'evolution', EVOLUTION_API_URL: 'http://evo:3000/', EVOLUTION_API_KEY: 'evokey' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'evo_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const p = selectWhatsAppProvider();
    const r = await p.sendText({ to: '+39 02 1234', text: 'hello' });
    expect(r.ok).toBe(true);
    expect(r.messageId).toBe('evo_1');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('http://evo:3000/message/send');
    const headers = (init?.headers as Record<string, string>) ?? {};
    expect(headers['Authorization']).toBe('Bearer evokey');
    const body = JSON.parse((init as any).body as string);
    expect(body.number).toBe('39021234');
    expect(body.text).toBe('hello');
  });

  it('strips trailing slash from configured URLs (wa-automate + evolution)', () => {
    setEnv({ WHATSAPP_PROVIDER: 'evolution', EVOLUTION_API_URL: 'http://evo:3000/', EVOLUTION_API_KEY: 'k' });
    const p = selectWhatsAppProvider();
    expect((p as any).baseUrl).toBe('http://evo:3000');
  });
});
