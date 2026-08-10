import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';

/**
 * Footer globale: appare in tutte le pagine (montato in root layout).
 * Per non duplicare il footer inline nella homepage, nella home è stato
 * rimosso il blocco <footer> e si usa questo componente.
 *
 * Link social: handle IG richiesto dal cliente = @sposilive
 * (https://www.instagram.com/sposilive/). Gli altri handle restano invariati.
 */
export default async function SiteFooter() {
  const t = await getTranslations('home');
  const c = await getTranslations('common');
  const h = await headers();
  const host = h.get('host') || '';
  const isIt = host.includes('sposi.live') || !host.includes('justmarry.live');
  const brand = isIt ? 'Sposi.live' : 'JustMarry.live';
  const logo = isIt ? '/logo-sposi-onlight.png' : '/logo-justmarry-onlight.png';
  const supportEmail = isIt ? 'info@sposi.live' : 'info@justmarry.live';

  return (
    <footer className="border-t border-border bg-bg">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="flex items-center gap-3 text-sm text-text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-8 w-auto" />
          {brand} — 2026 · {t('footer_tagline')} ·{' '}
          <a href={`mailto:${supportEmail}`} className="hover:text-brand transition-colors">
            {supportEmail}
          </a>{' '}
          ·{' '}
          <Link href="/privacy" className="hover:text-brand transition-colors">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link href="/partner/login" className="hover:text-brand transition-colors font-medium">
            {isIt ? 'Partner' : 'Partners'}
          </Link>
        </span>
      </div>
      {/* Loghi social: FB, Instagram, TikTok, X — handle IG = sposilive */}
      <div className="max-w-6xl mx-auto px-4 pb-8 flex flex-col items-center gap-3">
        <span className="text-xs text-text-muted uppercase tracking-wider">Seguici su</span>
        <div className="flex items-center gap-4">
          <a
            href="https://facebook.com/sposi.live"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="text-text-muted hover:text-brand transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>
          <a
            href="https://www.instagram.com/sposilive/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram @sposilive"
            className="text-text-muted hover:text-brand transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          </a>
          <a
            href="https://tiktok.com/@sposi.live"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="text-text-muted hover:text-brand transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1.01-.01-1.52.22-2.55 1.97-4.88 4.31-5.9 1.51-.65 3.24-.73 4.8-.2.02 1.48.01 2.96.01 4.44-.78-.25-1.66-.18-2.38.24-.99.58-1.58 1.74-1.49 2.89.06 1.32 1.16 2.45 2.44 2.65 1.4.25 2.84-.69 3.27-2.03.08-.4.13-.81.13-1.22.01-3.32 0-6.65.01-9.97.05-1.41.49-2.78 1.32-3.91 1.21-1.61 3.21-2.55 5.21-2.54z" />
            </svg>
          </a>
          <a
            href="https://x.com/SposiLive"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter) @SposiLive"
            className="text-text-muted hover:text-brand transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://www.threads.com/@sposilive"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Threads @sposilive"
            className="text-text-muted hover:text-brand transition-colors"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.186 24h-.001c-.001 0-.001 0 0 0-.103 0-.205 0-.308-.002-.425-.007-.857-.013-1.284-.054a13.367 13.367 0 0 1-1.474-.198 8.57 8.57 0 0 1-1.274-.39 8.352 8.352 0 0 1-1.355-.708 8.7 8.7 0 0 1-1.182-.974 8.516 8.516 0 0 1-.974-1.18 8.343 8.343 0 0 1-.71-1.356 8.622 8.622 0 0 1-.388-1.271 13.04 13.04 0 0 1-.198-1.475c-.04-.426-.047-.858-.053-1.283l-.001-.215V14.195c-.001-.07 0-.14 0-.211l.001-.214c.006-.425.013-.857.054-1.283.04-.495.103-.985.197-1.474a8.6 8.6 0 0 1 .39-1.272 8.343 8.343 0 0 1 .708-1.356c.302-.426.628-.819.974-1.181.363-.345.756-.672 1.182-.973a8.351 8.351 0 0 1 1.355-.709 8.58 8.58 0 0 1 1.274-.39c.49-.094.98-.157 1.474-.197.427-.041.86-.048 1.284-.054h.523c.425.006.857.013 1.284.054.494.04.984.103 1.474.197.434.104.851.229 1.272.39a8.35 8.35 0 0 1 1.356.709 8.7 8.7 0 0 1 1.181.973c.346.362.672.755.974 1.181.278.426.516.877.708 1.356.16.415.286.836.39 1.272.094.489.157.979.197 1.474.041.426.048.858.054 1.283l.001.214v.426l-.001.214c-.006.425-.013.857-.054 1.283a13.04 13.04 0 0 1-.197 1.475 8.622 8.622 0 0 1-.39 1.271 8.343 8.343 0 0 1-.708 1.356 8.516 8.516 0 0 1-.974 1.18 8.7 8.7 0 0 1-1.181.974 8.352 8.352 0 0 1-1.356.708 8.57 8.57 0 0 1-1.272.39c-.49.094-.98.157-1.474.198-.427.04-.859.047-1.284.054l-.214.001h-.316zm-1.27-19.46a11.84 11.84 0 0 0-1.168.04c-.42.034-.836.09-1.243.184a7.3 7.3 0 0 0-1.061.326 7.04 7.04 0 0 0-1.142.6 7.34 7.34 0 0 0-1.001.82 7.2 7.2 0 0 0-.82 1.001 7.04 7.04 0 0 0-.6 1.142 7.27 7.27 0 0 0-.327 1.061c-.094.408-.15.824-.184 1.244a11.84 11.84 0 0 0-.04 1.167v.426c0 .07 0 .141.002.211.006.41.014.823.064 1.226.038.41.097.819.184 1.226a7.27 7.27 0 0 0 .327 1.06c.157.39.357.762.6 1.142.235.386.515.738.82 1.001.294.294.622.557 1.001.82.38.242.752.442 1.142.6.346.131.702.234 1.06.326.408.094.824.15 1.244.184.41.05.823.058 1.226.064l.211.001h.426l.211-.001c.41-.006.823-.014 1.226-.064.41-.038.82-.097 1.226-.184a7.27 7.27 0 0 0 1.06-.326 7.04 7.04 0 0 0 1.142-.6c.386-.235.739-.515 1.001-.82.294-.294.557-.622.82-1.001.242-.38.442-.752.6-1.142.131-.346.234-.702.326-1.06.094-.408.15-.824.184-1.244a11.84 11.84 0 0 0 .04-1.167v-.426c0-.07 0-.141-.002-.211a11.84 11.84 0 0 0-.04-1.168 11.84 11.84 0 0 0-.184-1.243 7.27 7.27 0 0 0-.326-1.061 7.04 7.04 0 0 0-.6-1.142 7.34 7.34 0 0 0-.82-1.001 7.2 7.2 0 0 0-1.001-.82 7.04 7.04 0 0 0-1.142-.6 7.27 7.27 0 0 0-1.06-.327 11.84 11.84 0 0 0-1.244-.184 11.84 11.84 0 0 0-1.167-.04h-.426l-.211.001zm.106 11.46h-.001c-.39 0-.779-.03-1.166-.092a3.41 3.41 0 0 1-.99-.32 2.94 2.94 0 0 1-.785-.527 2.94 2.94 0 0 1-.527-.785 3.41 3.41 0 0 1-.32-.99 5.92 5.92 0 0 1-.092-1.165c0-.13.052-.255.144-.347a.49.49 0 0 1 .347-.144h1.182c.13 0 .255.052.347.144a.49.49 0 0 1 .144.347c0 .27.018.54.054.81.024.18.06.36.106.54.04.15.097.296.17.434.052.1.115.193.187.278.07.082.155.155.247.216.103.066.215.117.331.155.14.04.285.07.43.084.18.018.363.024.545.024.18 0 .363-.006.544-.024.146-.014.29-.044.43-.084.117-.038.228-.09.331-.155.092-.06.177-.134.247-.216.072-.085.135-.178.187-.278.073-.138.13-.284.17-.434.046-.18.082-.36.106-.54.036-.27.054-.54.054-.81 0-.13.052-.255.144-.347a.49.49 0 0 1 .347-.144h1.182c.13 0 .255.052.347.144a.49.49 0 0 1 .144.347c0 .39-.03.779-.092 1.165a3.41 3.41 0 0 1-.32.99 2.94 2.94 0 0 1-.527.785 2.94 2.94 0 0 1-.785.527 3.41 3.41 0 0 1-.99.32 5.92 5.92 0 0 1-1.166.092z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}
