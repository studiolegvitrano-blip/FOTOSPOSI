import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';
import LanguageSwitcher from '@/components/language-switcher';

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-lg border border-border bg-surface p-4">
      <summary className="flex cursor-pointer items-center justify-between gap-2 font-medium text-text">
        {q}
        <span className="text-brand transition-transform group-open:rotate-45">+</span>
      </summary>
      <p className="mt-2 text-sm text-text-muted leading-relaxed">{a}</p>
    </details>
  );
}

export default async function FaqPage() {
  const t = await getTranslations('faq');
  const c = await getTranslations('common');
  const n = await getTranslations('nav');

  const h = await headers();
  const host = h.get('host') || '';
  const isIt = host.includes('sposi.live') || !host.includes('justmarry.live');
  const logoDark = isIt ? '/logo-sposi-trans.png' : '/logo-justmarry-trans.png';

  const groups: Array<{ key: string; items: string[] }> = [
    { key: 'generale', items: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'] },
    { key: 'piattaforma', items: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
    { key: 'foto', items: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'] },
    { key: 'giochi', items: ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'] },
    { key: 'commerce', items: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] },
    { key: 'privacy', items: ['pr1', 'pr2', 'pr3', 'pr4', 'pr5', 'pr6'] },
    { key: 'tecnico', items: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'] },
  ];

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
            <Link
              href="/collaboratori"
              className="text-sm bg-white text-black px-4 py-2 rounded-md font-semibold hover:bg-white/90 transition-colors shadow-sm"
            >
              {n('collaboratori')}
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 pt-32 pb-16 space-y-10">
        <div className="text-center space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-text-muted max-w-xl mx-auto">{t('subtitle')}</p>
        </div>

        {groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <h2 className="text-xl font-semibold">{t(`groups.${group.key}`)}</h2>
            <div className="space-y-2">
              {group.items.map((item) => (
                <FaqItem
                  key={item}
                  q={t(`q.${group.key}.${item}`)}
                  a={t(`a.${group.key}.${item}`)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
