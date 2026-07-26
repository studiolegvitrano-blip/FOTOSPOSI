import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import LanguageSwitcher from '@/components/language-switcher';
import { PwaEventRedirect } from '@/components/pwa-event-redirect';
import { PwaSplash } from '@/components/pwa-splash';
import { AppDownloadBadges } from '@/components/app-download-badges';
import {
  Globe,
  Gamepad2,
  QrCode,
  Bot,
  MonitorPlay,
  HelpCircle,
  Camera,
  Video,
  Smile,
  BadgeCheck,
  CloudUpload,
  Check,
  ChevronDown,
} from 'lucide-react';
import ThreePhonesShowcase from '@/components/three-phones-showcase';
import WatermarkMaxPreview from '@/components/watermark-max-preview';

const PLATFORM_ICONS = [Globe, Gamepad2, QrCode, Bot];
const GAME_ICONS = [MonitorPlay, HelpCircle, Camera, Video, Smile];

type Item = { title: string; desc: string };

export default async function Home() {
  const t = await getTranslations('home');
  const c = await getTranslations('common');
  const n = await getTranslations('nav');

  const h = await headers();
  const host = h.get('host') || '';
  const isIt = host.includes('sposi.live') || !host.includes('justmarry.live');
  const logoLight = isIt ? '/logo-sposi-onlight.png' : '/logo-justmarry-onlight.png';
  const logoDark = isIt ? '/logo-sposi-trans.png' : '/logo-justmarry-trans.png';

  const platformItems = t.raw('platform_items') as Item[];
  const howSteps = t.raw('how_steps') as Item[];
  const games = t.raw('games') as Item[];
  const stats = t.raw('stats') as { value: string; label: string }[];
  const planFreeFeatures = t.raw('plan_free_features') as string[];
  const planPremiumFeatures = t.raw('plan_premium_features') as string[];
  const planDeluxeFeatures = t.raw('plan_deluxe_features') as string[];

  return (
    <main className="min-h-screen bg-bg">
      <PwaEventRedirect />
      <PwaSplash />
      <AppDownloadBadges />

      {/* ── Nav: sfondo nero, logo top-left 2× ──────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-40 bg-black border-b border-white/10 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2.5">
          {/* Logo top-left ingrandito 2× */}
          <Link href="/" className="flex items-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoDark} alt={c('brand_name')} className="h-[80px] sm:h-[96px] w-auto shrink-0 object-contain" />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="text-sm font-medium text-white/85 hover:text-white px-3 py-2 rounded-md transition-colors"
            >
              {n('login')}
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-white text-black px-4 py-2 rounded-md font-semibold hover:bg-white/90 transition-colors shadow-sm"
            >
              {n('signup')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero: 3 telefoni come carte da gioco ──────────────────────── */}
      <section className="pt-32 pb-2 bg-gradient-to-b from-bg via-bg to-muted/40">
        <div className="max-w-6xl mx-auto px-4 pt-8 pb-6 text-center">
          <span className="inline-block text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-brand mb-3">
            {t('showcase_title')}
          </span>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-4 text-balance text-text leading-[1.1]">
            {t('hero_title')}
          </h1>
          <p className="text-base sm:text-lg text-text-muted mb-8 max-w-2xl mx-auto leading-relaxed">
            {t('hero_subtitle')}
          </p>
        </div>

        <ThreePhonesShowcase />

        <p className="text-text-muted text-xs text-center mt-2 pb-2">{t('hero_note')}</p>
      </section>

      {/* ── DEMO FEED rimosso: ora vive solo dentro la pagina pubblica
          del matrimonio (/sito/[id]) dove gli invitati lo vivono davvero. ── */}

      {/* ── Piattaforma unica (card compatte) ─────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">
          {t('platform_title')}
        </h2>
        <p className="text-text-muted text-center max-w-2xl mx-auto mb-8 text-sm">{t('platform_subtitle')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {platformItems.map((item, i) => {
            const Icon = PLATFORM_ICONS[i] ?? Globe;
            return (
              <div key={i} className="fb-card p-5 h-full">
                <span className="inline-flex w-10 h-10 rounded-full bg-brand/10 text-brand items-center justify-center mb-3">
                  <Icon size={20} />
                </span>
                <h3 className="font-semibold text-base mb-1.5">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Come funziona ──────────────────────────────────────────────── */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-8">
            {t('how_title')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {howSteps.map((step, i) => (
              <div key={i} className="text-center">
                <span className="text-5xl text-brand/40 font-semibold block mb-3">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-base mb-1.5">{step.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Giochi in evidenza ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">
          {t('games_title')}
        </h2>
        <p className="text-text-muted text-center max-w-2xl mx-auto mb-8 text-sm">{t('games_subtitle')}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game, i) => {
            const Icon = GAME_ICONS[i] ?? Gamepad2;
            return (
              <div key={i} className="fb-card p-5 h-full hover:shadow-md transition-shadow">
                <span className="inline-flex w-10 h-10 rounded-xl bg-brand/10 text-brand items-center justify-center mb-3">
                  <Icon size={20} />
                </span>
                <h3 className="font-semibold text-base mb-1.5">{game.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{game.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Watermark MAX ─────────────────────────────────────────────── */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-brand text-xs font-medium uppercase tracking-wider mb-3">
              <BadgeCheck size={16} /> {t('watermark_kicker')}
            </span>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-3">{t('watermark_title')}</h2>
            <p className="text-text-muted leading-relaxed text-sm">{t('watermark_desc')}</p>
          </div>
          <WatermarkMaxPreview />
        </div>
      </section>

      {/* ── Drive backup ──────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-10 items-center">
        <div className="lg:order-2">
          <span className="inline-flex items-center gap-2 text-brand text-xs font-medium uppercase tracking-wider mb-3">
            <CloudUpload size={16} /> {t('drive_kicker')}
          </span>
          <h2 className="text-2xl sm:text-3xl font-semibold mb-3">{t('drive_title')}</h2>
          <p className="text-text-muted leading-relaxed text-sm">{t('drive_desc')}</p>
        </div>
        <div className="lg:order-1 fb-card p-8 flex flex-col items-center gap-4">
          <CloudUpload size={40} className="text-brand" />
          <p className="text-sm text-text-muted text-center">{t('drive_caption')}</p>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────────── */}
      <section className="bg-surface border-y border-border" id="pricing">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center mb-3">
            {t('pricing_title')}
          </h2>
          <p className="text-text-muted text-center max-w-2xl mx-auto mb-8 text-sm">{t('pricing_subtitle')}</p>
          <div className="grid md:grid-cols-3 gap-4 items-stretch">
            {(
              [
                { name: t('plan_free_name'), price: '€0', features: planFreeFeatures, highlight: false, games: false },
                { name: t('plan_premium_name'), price: '€229', features: planPremiumFeatures, highlight: true, games: true },
                { name: t('plan_deluxe_name'), price: '€375', features: planDeluxeFeatures, highlight: false, games: true },
              ] as const
            ).map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-xl p-6 h-full flex flex-col ${
                  plan.highlight ? 'border-2 border-brand shadow-md bg-brand/5' : 'fb-card'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-medium px-3 py-1 rounded-md whitespace-nowrap">
                    {t('plan_popular')}
                  </span>
                )}
                <h3 className="font-semibold text-base mb-1">{plan.name}</h3>
                <p className="text-3xl font-semibold mb-1">{plan.price}</p>
                {plan.games && (
                  <span className="inline-flex items-center gap-1.5 self-start bg-brand/10 text-brand text-xs font-medium px-3 py-1 rounded-full mb-3 mt-1">
                    <Gamepad2 size={13} /> {t('plan_games_badge')}
                  </span>
                )}
                <ul className="space-y-2 text-sm text-text-muted mt-3 mb-6 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <Check size={16} className="text-brand shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`block text-center px-5 py-2.5 rounded-md font-medium transition-colors text-sm ${
                    plan.highlight
                      ? 'bg-brand text-white hover:bg-brand-dark'
                      : 'bg-muted text-brand hover:bg-border'
                  }`}
                >
                  {t('plan_cta')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Numeri ────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {stats.map((s, i) => (
            <div key={i}>
              <p className="text-3xl font-semibold text-brand mb-0.5">{s.value}</p>
              <p className="text-xs text-text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA finale ─────────────────────────────────────────────────── */}
      <section className="bg-brand">
        <div className="max-w-3xl mx-auto px-4 py-14 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoDark} alt="" className="h-20 sm:h-24 w-auto mx-auto mb-5" />
          <h2 className="text-2xl sm:text-3xl font-semibold mb-3 text-white text-balance">
            {t('final_cta_title')}
          </h2>
          <p className="text-white/85 mb-6 text-base">{t('final_cta_subtitle')}</p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 bg-white text-brand rounded-md font-semibold hover:bg-muted transition-all text-base"
          >
            {t('cta_signup')}
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-bg">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="flex items-center gap-3 text-sm text-text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoLight} alt="" className="h-8 w-auto" />
            {c('brand_name')} — {t('footer_tagline')}
          </span>
          <LanguageSwitcher />
        </div>
        {/* Loghi social: FB, Instagram, TikTok, X */}
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
              href="https://instagram.com/sposi.live"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
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
              href="https://x.com/sposilive"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="text-text-muted hover:text-brand transition-colors"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
