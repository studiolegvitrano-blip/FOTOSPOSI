import { createHmac, timingSafeEqual } from 'crypto';

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

/** HMAC key derivata dalla password stessa: se la password cambia, le sessioni si invalidano. */
function hmacKey(): string {
  return createHmac('sha256', 'fotosposi-ceo-session').update(ceoPassword()).digest('hex');
}

export function signCeoSession(now = Date.now()): string {
  const exp = now + CEO_SESSION_HOURS * 60 * 60 * 1000;
  const payload = `fotosposi-ceo.${exp}`;
  const sig = createHmac('sha256', hmacKey()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Verifica il cookie sessione: ritorna true se la firma è valida e non scaduta. */
export function verifyCeoSession(token: string | undefined | null, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [head, expStr, sig] = parts;
  const payload = `${head}.${expStr}`;
  const expected = createHmac('sha256', hmacKey()).update(payload).digest('base64url');
  const a = Buffer.from(sig as string);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= now) return false;
  return true;
}

/** Confronto timing-safe password fornita vs CEO_PASSWORD configurata. */
export function ceoPasswordMatches(input: string): boolean {
  const configured = ceoPassword();
  if (!configured) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(configured);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
