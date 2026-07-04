import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import LanguageSwitcher from '@/components/language-switcher';
import {
  Camera,
  QrCode,
  Gamepad2,
  Gift,
  Sparkles,
  Check,
  Heart,
} from 'lucide-react';

const FEATURE_ICONS = [Sparkles, QrCode, Camera, Gamepad2, Gift];

export default async function Home() {
  const t = await getTranslations('home');
  const c = await getTranslations('common');
  const n = await getTranslations('nav');

  const features = t.raw('features') as string[];

  return (
    <main className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Heart size={20} className="text-brand" fill="currentColor" />
            {c('brand_name')}
          </span>
          <div className="flex items-center gap-5">
            <LanguageSwitcher />
            <Link href="/login" className="text-sm text-text-muted hover:text-text transition-colors">
              {n('login')}
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-brand text-white px-4 py-2 rounded-full font-medium hover:bg-brand-dark transition-colors"
            >
              {n('signup')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 50% at 50% 0%, var(--color-brand-light) 0%, var(--color-bg) 70%)',
            opacity: 0.5,
          }}
        />
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-2 bg-white border border-border rounded-full px-4 py-1.5 text-xs font-medium text-brand-dark shadow-sm mb-6">
            <Sparkles size={14} />
            {t('badge')}
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-5 text-balance">
            {t('hero_title')}
          </h1>
          <p className="text-lg text-text-muted mb-10 max-w-xl mx-auto leading-relaxed">
            {t('hero_subtitle')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3 bg-brand text-white rounded-full font-medium hover:bg-brand-dark transition-colors shadow-sm"
            >
              {t('cta_signup')}
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 border-2 border-border text-text rounded-full font-medium hover:border-brand hover:text-brand transition-colors"
            >
              {t('cta_login')}
            </Link>
          </div>
        </div>

        {/* Decorative photo-frame grid (placeholder art, no external images) */}
        <div className="max-w-4xl mx-auto px-6 pb-20 grid grid-cols-3 sm:grid-cols-5 gap-4">
          {FEATURE_ICONS.map((Icon, i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-2xl bg-white border border-border shadow-sm flex items-center justify-center"
              style={{ transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (2 + i)}deg)` }}
            >
              <Icon className="text-brand/60" size={28} />
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-bold mb-10 text-center">
          {t('how_it_works')}
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {features.map((f, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length] ?? Sparkles;
            return (
              <div
                key={i}
                className="flex items-start gap-4 bg-white border border-border rounded-2xl p-5"
              >
                <span className="shrink-0 w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center">
                  <Icon size={18} />
                </span>
                <p className="text-text pt-1.5 leading-snug">{f}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plans teaser */}
      <section className="bg-white border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-10 text-center">
            {t('plans_title')}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {(
              [
                ['plan_free_name', 'plan_free_desc'],
                ['plan_premium_name', 'plan_premium_desc'],
                ['plan_deluxe_name', 'plan_deluxe_desc'],
              ] as const
            ).map(([nameKey, descKey], i) => (
              <div
                key={nameKey}
                className={`rounded-2xl p-6 border ${
                  i === 1
                    ? 'border-brand shadow-md bg-brand/5 relative'
                    : 'border-border bg-bg'
                }`}
              >
                {i === 1 && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-medium px-3 py-1 rounded-full">
                    {t('plan_popular')}
                  </span>
                )}
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <Check size={16} className="text-brand" />
                  {t(nameKey)}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">{t(descKey)}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block px-8 py-3 bg-brand text-white rounded-full font-medium hover:bg-brand-dark transition-colors"
            >
              {t('plan_cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-3">{t('final_cta_title')}</h2>
        <p className="text-text-muted mb-8">{t('final_cta_subtitle')}</p>
        <Link
          href="/signup"
          className="inline-block px-8 py-3 bg-brand text-white rounded-full font-medium hover:bg-brand-dark transition-colors"
        >
          {t('cta_signup')}
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-semibold text-sm text-text-muted">
            <Heart size={14} className="text-brand" fill="currentColor" />
            {c('brand_name')} — {t('footer_tagline')}
          </span>
          <LanguageSwitcher />
        </div>
      </footer>
    </main>
  );
}
