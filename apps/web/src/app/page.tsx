import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import LanguageSwitcher from '@/components/language-switcher';

export default async function Home() {
  const t = await getTranslations('home');
  const c = await getTranslations('common');
  const n = await getTranslations('nav');

  const features = t.raw('features') as string[];

  return (
    <main className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b max-w-5xl mx-auto">
        <span className="font-bold text-lg">{c('brand_name')}</span>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">{n('login')}</Link>
          <Link href="/signup" className="text-sm bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">{n('signup')}</Link>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold mb-4">{t('hero_title')}</h1>
        <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto">{t('hero_subtitle')}</p>
        <div className="flex gap-4 justify-center">
          <Link href="/login" className="px-8 py-3 bg-brand text-white rounded-lg font-medium hover:bg-brand-dark transition-colors">{t('cta_login')}</Link>
          <Link href="/signup" className="px-8 py-3 border-2 border-brand text-brand rounded-lg font-medium hover:bg-brand/5 transition-colors">{t('cta_signup')}</Link>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold mb-6">{t('how_it_works')}</h2>
        <ul className="space-y-3">
          {features.map((f: string, i: number) => (
            <li key={i} className="flex items-center gap-3 text-gray-700">
              <span className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-medium">{i + 1}</span>
              {f}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
