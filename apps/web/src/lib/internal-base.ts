import { headers } from 'next/headers';

/**
 * Base URL assoluta per fetch interne server-side.
 *
 * NON usare NEXT_PUBLIC_VERCEL_URL: in produzione punta all'URL del singolo
 * deployment (es. fotosposi-hnh3zgi4u-xxx.vercel.app), protetto dietro SSO
 * Vercel → la fetch riceve 302 verso vercel.com/sso-api → pagina HTML →
 * `res.json()` esplode con "Unexpected token '<', \"<!DOCTYPE ..." anche se
 * la route API risponde JSON corretto sul dominio pubblico.
 *
 * Usa l'host reale della request in arrivo (x-forwarded-host su Vercel),
 * quindi funziona sia su www.sposi.live/justmarry.live sia in locale.
 */
export async function internalBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
