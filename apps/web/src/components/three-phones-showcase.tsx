'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

type Phone = {
  captionKey: string;
  authorKey: string;
  badgeKey: string;
  src: string;
  href: string;
  rotate: number;
  offsetY: number;
};

const PHONES: Phone[] = [
  {
    captionKey: 'home.showcase_phone1_caption',
    authorKey: 'home.showcase_phone1_author',
    badgeKey: 'home.showcase_phone1_badge',
    src: '/marketing/hero/marriage-1-mobile.png',
    href: '/signup',
    rotate: -8,
    offsetY: 12,
  },
  {
    captionKey: 'home.showcase_phone2_caption',
    authorKey: 'home.showcase_phone2_author',
    badgeKey: 'home.showcase_phone2_badge',
    src: '/marketing/hero/marriage-2-mobile.png',
    href: '/signup',
    rotate: 0,
    offsetY: 0,
  },
  {
    captionKey: 'home.showcase_phone3_caption',
    authorKey: 'home.showcase_phone3_author',
    badgeKey: 'home.showcase_phone3_badge',
    src: '/marketing/hero/marriage-3-mobile.png',
    href: '/signup',
    rotate: 8,
    offsetY: 12,
  },
];

export default function ThreePhonesShowcase() {
  const t = useTranslations();
  const cta = t('home.showcase_cta');
  const subtitle = t('home.showcase_subtitle');

  return (
    <div className="relative w-full max-w-3xl mx-auto px-4" style={{ minHeight: 540 }}>
      <div className="absolute inset-x-0 top-10 flex justify-center gap-3 sm:gap-5 px-4 perspective-1000">
        {PHONES.map((p, i) => (
          <Link
            key={i}
            href={p.href}
            aria-label={t(p.badgeKey)}
            className="relative block transition-transform duration-300 ease-out hover:-translate-y-2 hover:scale-[1.03] cursor-pointer"
            style={{
              width: '30%',
              maxWidth: 240,
              minWidth: 150,
              transform: `rotate(${p.rotate}deg) translateY(${p.offsetY}px)`,
              zIndex: i === 1 ? 20 : 10,
            }}
          >
            {/* Cornice telefono */}
            <div
              className="relative rounded-[28px] sm:rounded-[36px] bg-gray-900 p-1.5 sm:p-2 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.45),0_18px_30px_-12px_rgba(0,0,0,0.3)] ring-1 ring-black/10"
              style={{ aspectRatio: '9/19' }}
            >
              <div className="absolute inset-x-0 top-1.5 sm:top-2 mx-auto h-4 sm:h-5 w-16 sm:w-20 rounded-full bg-gray-900 z-10" />
              <div className="relative h-full w-full overflow-hidden rounded-[22px] sm:rounded-[30px] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.src}
                  alt={t(p.badgeKey)}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading={i === 1 ? undefined : 'lazy'}
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-2.5 sm:p-3.5 pt-7 sm:pt-9">
                  <span className="block text-[10px] sm:text-[11px] font-medium text-white/95 leading-snug drop-shadow">
                    {t(p.captionKey)}
                  </span>
                  <span className="mt-1 block text-[9px] sm:text-[10px] text-white/70 truncate">
                    — {t(p.authorKey)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA + micro-copy sotto i telefoni, dimensionato per non sovrapporsi */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center px-4"
        style={{ paddingTop: 470 }}
      >
        <p className="max-w-md text-sm text-text-muted leading-relaxed">{subtitle}</p>
        <Link
          href="/signup"
          className="mt-4 inline-block px-7 py-3 bg-brand text-white rounded-md font-semibold hover:bg-brand-dark transition-all shadow-sm text-[15px]"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
