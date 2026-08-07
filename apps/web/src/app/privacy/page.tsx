import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import LanguageSwitcher from '@/components/language-switcher';

export default async function PrivacyPage() {
  const t = await getTranslations('privacyPolicy');
  const c = await getTranslations('common');
  const n = await getTranslations('nav');

  const h = await headers();
  const host = h.get('host') || '';
  const isIt = host.includes('sposi.live') || !host.includes('justmarry.live');
  const logoDark = isIt ? '/logo-sposi-trans.png' : '/logo-justmarry-trans.png';

  const sections = [0, 1, 2, 3, 4, 5, 6];

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-40 bg-black border-b border-white/10 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2.5">
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
              className="text-sm font-medium text-white/85 hover:text-white px-3 py-2 rounded-md transition-colors"
            >
              {n('signup')}
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 pt-32 pb-16 space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-text-muted max-w-xl mx-auto">{t('subtitle')}</p>
          <p className="text-xs text-text-muted">{t('updated')}</p>
        </div>

        <div className="space-y-8">
          {sections.map((i) => (
            <section key={i} className="space-y-2">
              <h2 className="text-lg font-semibold">{t(`sections.${i}.h`)}</h2>
              <p className="text-sm text-text-muted leading-relaxed">{t(`sections.${i}.p`)}</p>
            </section>
          ))}
        </div>
      </main>
    </>
  );
}
