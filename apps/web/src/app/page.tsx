import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import LanguageSwitcher from '@/components/language-switcher';
import { PwaEventRedirect } from '@/components/pwa-event-redirect';
import { PwaSplash } from '@/components/pwa-splash';
import { AppDownloadBadges } from '@/components/app-download-badges';
import { Reveal } from '@/components/reveal';
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

const PLATFORM_ICONS = [Globe, Gamepad2, QrCode, Bot];
const GAME_ICONS = [MonitorPlay, HelpCircle, Camera, Video, Smile];

type Item = { title: string; desc: string };

export default async function Home() {
  const t = await getTranslations('home');
  const c = await getTranslations('common');
  const n = await getTranslations('nav');

  // Stesso rilevamento brand già usato in layout.tsx (favicon) — sceglie il logo giusto
  // in base al dominio da cui si sta navigando. Da questa versione i loghi sono PNG a sfondo
  // TRASPARENTE (generati dal file originale a sfondo navy pieno): "onlight" per sfondi chiari
  // (scritta .Live in navy) e "trans" per sfondi scuri o foto (scritta .Live in bianco).
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

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-40 bg-bg/85 backdrop-blur-md border-b border-border/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-2.5">
          {/* Logo trasparente, ben integrato sulla nav chiara (niente più badge nero) */}
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {/* Logo ingrandito oltre il doppio (48→104px, 56→120px) */}
            <img src={logoLight} alt={c('brand_name')} className="h-26 sm:h-30 w-auto" />
          </Link>
          <div className="flex items-center gap-5">
            <LanguageSwitcher />
            <Link href="/login" className="text-sm text-text-muted hover:text-text transition-colors">
              {n('login')}
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-brand text-white px-5 py-2.5 rounded-full font-medium hover:bg-brand-dark transition-colors shadow-sm"
            >
              {n('signup')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero stile Zola: fondo chiaro, titolo serif scuro (sempre leggibile),
             logo grande in evidenza, foto in card arrotondata sotto ─────────── */}
      <section className="relative overflow-hidden">
        {/* padding-top aumentato per compensare la nav più alta col logo ingrandito */}
        <div className="max-w-5xl mx-auto px-6 pt-44 sm:pt-52 pb-8 text-center">
          {/* Logo protagonista: trasparente, ~4x rispetto alla vecchia versione nel badge */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoLight}
            alt={c('brand_name')}
            className="h-28 sm:h-40 w-auto mx-auto mb-8"
          />
          <span className="inline-flex items-center gap-2 bg-white border border-border rounded-full px-4 py-1.5 text-xs font-medium text-brand-dark shadow-sm mb-8 tracking-wide uppercase">
            {t('badge')}
          </span>
          <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 text-balance text-text leading-[1.08]">
            {t('hero_title')}
          </h1>
          <p className="text-lg sm:text-xl text-text-muted mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('hero_subtitle')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-brand text-white rounded-full font-semibold hover:bg-brand-dark transition-all hover:shadow-lg shadow-md text-base"
            >
              {t('cta_signup')}
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border-2 border-text/20 text-text rounded-full font-semibold hover:border-brand hover:text-brand-dark transition-colors text-base"
            >
              {t('cta_login')}
            </Link>
          </div>
          <p className="text-text-muted text-sm mt-6">{t('hero_note')}</p>
        </div>

        {/* Foto sposi in card (stile Zola): cornice arrotondata con ombra, invece che
            sfondo a tutto schermo — più elegante e più clemente con la qualità della foto. */}
        <div className="max-w-4xl mx-auto px-6 pb-16">
          <div className="rounded-3xl overflow-hidden shadow-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/hero-wedding.jpg" alt="" className="w-full h-auto object-cover" />
          </div>
          <div className="flex justify-center mt-8 text-text-muted animate-bounce">
            <ChevronDown size={28} aria-hidden />
          </div>
        </div>
      </section>

      {/* ── Piattaforma unica ───────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-center mb-4">
            {t('platform_title')}
          </h2>
          <p className="text-text-muted text-center max-w-2xl mx-auto mb-14">{t('platform_subtitle')}</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {platformItems.map((item, i) => {
            const Icon = PLATFORM_ICONS[i] ?? Globe;
            return (
              <Reveal key={i} delay={i * 100}>
                <div className="bg-surface border border-border rounded-2xl p-7 h-full hover:shadow-md transition-shadow">
                  <span className="inline-flex w-12 h-12 rounded-full bg-brand/10 text-brand items-center justify-center mb-5">
                    <Icon size={22} />
                  </span>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Come funziona (3 passi) ─────────────────────────────────────── */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-center mb-14">
              {t('how_title')}
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-10">
            {howSteps.map((step, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="text-center">
                  <span className="font-display text-6xl text-brand/40 font-semibold block mb-4">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Giochi in evidenza ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <Reveal>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold text-center mb-4">
            {t('games_title')}
          </h2>
          <p className="text-text-muted text-center max-w-2xl mx-auto mb-14">{t('games_subtitle')}</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {games.map((game, i) => {
            const Icon = GAME_ICONS[i] ?? Gamepad2;
            return (
              <Reveal key={i} delay={i * 80}>
                <div className="bg-surface border border-border rounded-2xl p-7 h-full hover:shadow-md hover:-translate-y-0.5 transition-all">
                  <span className="inline-flex w-11 h-11 rounded-xl bg-brand/10 text-brand items-center justify-center mb-4">
                    <Icon size={20} />
                  </span>
                  <h3 className="font-semibold text-lg mb-2">{game.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{game.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Watermark MAX ───────────────────────────────────────────────── */}
      <section className="bg-surface border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 text-brand-dark text-xs font-medium uppercase tracking-wider mb-4">
              <BadgeCheck size={16} /> {t('watermark_kicker')}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-5">{t('watermark_title')}</h2>
            <p className="text-text-muted leading-relaxed">{t('watermark_desc')}</p>
          </Reveal>
          <Reveal delay={150}>
            {/* Mock visivo: cornice foto con monogramma in basso a destra */}
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg border border-border">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: 'url(/hero-wedding.jpg)' }}
              />
              <span className="absolute bottom-3 right-3 bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg text-white font-display text-sm tracking-wide">
                G & A
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Drive backup ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
        <Reveal className="lg:order-2">
          <span className="inline-flex items-center gap-2 text-brand-dark text-xs font-medium uppercase tracking-wider mb-4">
            <CloudUpload size={16} /> {t('drive_kicker')}
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-5">{t('drive_title')}</h2>
          <p className="text-text-muted leading-relaxed">{t('drive_desc')}</p>
        </Reveal>
        <Reveal delay={150} className="lg:order-1">
          <div className="bg-surface border border-border rounded-2xl p-10 flex flex-col items-center gap-4 shadow-sm">
            <CloudUpload size={48} className="text-brand" />
            <p className="text-sm text-text-muted text-center">{t('drive_caption')}</p>
          </div>
        </Reveal>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="bg-surface border-y border-border" id="pricing">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-center mb-4">
              {t('pricing_title')}
            </h2>
            <p className="text-text-muted text-center max-w-2xl mx-auto mb-14">{t('pricing_subtitle')}</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {(
              [
                { name: t('plan_free_name'), price: '€0', features: planFreeFeatures, highlight: false, games: false },
                { name: t('plan_premium_name'), price: '€229', features: planPremiumFeatures, highlight: true, games: true },
                { name: t('plan_deluxe_name'), price: '€375', features: planDeluxeFeatures, highlight: false, games: true },
              ] as const
            ).map((plan, i) => (
              <Reveal key={i} delay={i * 100} className="h-full">
                <div
                  className={`relative rounded-2xl p-8 h-full flex flex-col border ${
                    plan.highlight ? 'border-brand shadow-lg bg-brand/5' : 'border-border bg-bg'
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-medium px-4 py-1 rounded-full whitespace-nowrap">
                      {t('plan_popular')}
                    </span>
                  )}
                  <h3 className="font-semibold text-lg mb-1">{plan.name}</h3>
                  <p className="font-display text-4xl font-semibold mb-1">{plan.price}</p>
                  {plan.games && (
                    <span className="inline-flex items-center gap-1.5 self-start bg-brand/10 text-brand-dark text-xs font-medium px-3 py-1 rounded-full mb-4 mt-2">
                      <Gamepad2 size={13} /> {t('plan_games_badge')}
                    </span>
                  )}
                  <ul className="space-y-2.5 text-sm text-text-muted mt-4 mb-8 flex-1">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        <Check size={16} className="text-brand shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={`block text-center px-6 py-3 rounded-full font-medium transition-colors ${
                      plan.highlight
                        ? 'bg-brand text-white hover:bg-brand-dark'
                        : 'border border-brand text-brand-dark hover:bg-brand/10'
                    }`}
                  >
                    {t('plan_cta')}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Numeri ──────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {stats.map((s, i) => (
            <Reveal key={i} delay={i * 80}>
              <p className="font-display text-4xl font-semibold text-brand-dark mb-1">{s.value}</p>
              <p className="text-sm text-text-muted">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA finale ──────────────────────────────────────────────────── */}
      <section className="bg-text">
        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          <Reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoDark} alt="" className="h-24 sm:h-32 w-auto mx-auto mb-8" />
            <h2 className="font-display text-3xl sm:text-5xl font-semibold mb-4 text-white text-balance">
              {t('final_cta_title')}
            </h2>
            <p className="text-white/70 mb-10 text-lg">{t('final_cta_subtitle')}</p>
            <Link
              href="/signup"
              className="inline-block px-10 py-4 bg-brand text-white rounded-full font-medium hover:bg-brand-dark transition-all hover:shadow-lg text-lg"
            >
              {t('cta_signup')}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-bg">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <span className="flex items-center gap-3 text-sm text-text-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoLight} alt="" className="h-9 w-auto" />
            {c('brand_name')} — {t('footer_tagline')}
          </span>
          <LanguageSwitcher />
        </div>
      </footer>
    </main>
  );
}
