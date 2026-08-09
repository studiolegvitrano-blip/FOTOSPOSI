/**
 * Autenticazione della console CEO (/ceo).
 *
 * La console CEO è separata dall'auth Supabase: è protetta da una password
 * single-user memorizzata in env (`CEO_PASSWORD`), che deve rispettare la
 * policy: almeno 8 caratteri con maiuscole + minuscole + numeri + simboli.
 *
 * Flusso:
 * 1. POST /api/ceo/login con { password } → verifica in timing-safe contro
 *    CEO_PASSWORD → setta un cookie httpOnly firmato HMAC-SHA256.
 * 2. GET /api/ceo/overview (e tutte le API /api/ceo/*) → verifica il cookie.
 * 3. POST /api/ceo/logout → cancella il cookie.
 *
 * Il cookie contiene solo una timestamp di scadenza (exp) + firma HMAC; nessun
 * dato identificativo. La sessione dura 12 ore (CEO_SESSION_HOURS).
 *
 * NOTA 09/08/2026: edge runtime compatibility. Questo file è importato sia da
 * route Node (`/api/ceo/*`) sia dal middleware Edge (`/admin/*` gate). Node
 * `crypto` (createHmac, timingSafeEqual) NON è disponibile in Edge Runtime
 * → bug scoperto navigando su /admin/* in produzione (deploy 6becfd5).
 * Fix: Web Crypto API (`globalThis.crypto.subtle`) + Uint8Array comparison.
 * Disponibile in Node 16+, Edge Runtime, browser moderni.
 */

export const CEO_COOKIE = 'ceo_session';
export const CEO_SESSION_HOURS = 12;

export interface CeoPasswordPolicy {
  ok: boolean;
  errors: string[];
}

/** Policy password CEO: >=8 char, una maiuscola, una minuscola, un numero, un simbolo. */
export function validateCeoPasswordPolicy(password: string): CeoPasswordPolicy {
  const errors: string[] = [];
  if (password.length < 8) errors.push('almeno 8 caratteri');
  if (!/[A-Z]/.test(password)) errors.push('una lettera maiuscola');
  if (!/[a-z]/.test(password)) errors.push('una lettera minuscola');
  if (!/[0-9]/.test(password)) errors.push('un numero');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('un simbolo (es. !@#$%^&*)');
  return { ok: errors.length === 0, errors };
}

function ceoPassword(): string {
  return process.env.CEO_PASSWORD || '';
}

/** Converte una stringa in Uint8Array (compatibile Edge + Node 16+). */
function toBytes(s: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(s);
}

/** Converte Uint8Array in stringa base64url (no padding). */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 = (typeof btoa !== 'undefined' ? btoa : (b: string) => Buffer.from(b, 'binary').toString('base64'))(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Confronto timing-safe di due Uint8Array (libreria standard non c'è in Web Crypto). */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= (a[i]! ^ b[i]!);
  return result === 0;
}

/**
 * HMAC-SHA256 cross-runtime (Edge + Node 16+). Restituisce Uint8Array.
 * Usa Web Crypto API (globalThis.crypto.subtle) disponibile ovunque.
 */
async function hmacSha256(key: string, data: string): Promise<Uint8Array> {
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    toBytes(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const sig = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, toBytes(data));
  return new Uint8Array(sig);
}

/**
 * Firma sincrona del cookie CEO (usata da /api/ceo/login in Node runtime).
 * Versione async per supportare Web Crypto (necessaria in Edge).
 *
 * Workaround: in Node 16+ globalThis.crypto.subtle ESISTE, ed è async.
 * Quindi sign/verify sono async ovunque. I call site già async (fetch, ecc.)
 * non notano differenza. In /api/ceo/login: basta await signCeoSession().
 */
export async function signCeoSession(now = Date.now()): Promise<string> {
  const pwd = ceoPassword();
  if (!pwd) return '';
  const exp = now + CEO_SESSION_HOURS * 60 * 60 * 1000;
  const payload = `fotosposi-ceo.${exp}`;
  const sigBytes = await hmacSha256(pwd, payload);
  const sig = bytesToBase64Url(sigBytes);
  return `${payload}.${sig}`;
}

/** Verifica il cookie sessione (async per Web Crypto). Ritorna true se firma valida e non scaduta. */
export async function verifyCeoSession(token: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [head, expStr, sigStr] = parts;
  const payload = `${head}.${expStr}`;
  const pwd = ceoPassword();
  if (!pwd) return false;
  const expectedBytes = await hmacSha256(pwd, payload);
  const expected = bytesToBase64Url(expectedBytes);
  const a = toBytes(sigStr as string);
  const b = toBytes(expected);
  if (!timingSafeEqualBytes(a, b)) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= now) return false;
  return true;
}

/** Confronto timing-safe password fornita vs CEO_PASSWORD configurata. */
export function ceoPasswordMatches(input: string): boolean {
  const configured = ceoPassword();
  if (!configured) return false;
  const a = toBytes(input);
  const b = toBytes(configured);
  if (a.length !== b.length) return false;
  return timingSafeEqualBytes(a, b);
}

/** True se la env CEO_PASSWORD è configurata e rispetta la policy. */
export function isCeoPasswordConfigured(): { configured: boolean; policyOk: boolean } {
  const pwd = ceoPassword();
  if (!pwd) return { configured: false, policyOk: false };
  return { configured: true, policyOk: validateCeoPasswordPolicy(pwd).ok };
}

/** Estrae e valida il token dal cookie header di una request. */
export function ceoTokenFromCookies(cookieHeader: string | undefined | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === CEO_COOKIE && rest.length > 0) return rest.join('=');
  }
  return null;
}
