'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import CountryFlag from './country-flag';

const locales = [
  { code: 'it', label: 'Italiano' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  function switchLocale(code: string) {
    setOpen(false);
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  }

  // Chiusura al click esterno e al blur (accessibilità).
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = (locales.find((l) => l.code === locale) ?? locales[0]) as (typeof locales)[number];
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Cambia lingua"
        className="flex items-center gap-1.5 text-sm text-white/85 hover:text-white transition-colors cursor-pointer px-2 py-2 rounded-md hover:bg-white/10"
      >
        <Globe size={16} />
        <CountryFlag code={current.code} className="w-5 h-3.5 rounded-[2px] ring-1 ring-white/20" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[180px] z-50"
        >
          {locales.map((l) => (
            <button
              key={l.code}
              role="menuitemradio"
              aria-checked={locale === l.code}
              onClick={() => switchLocale(l.code)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md flex items-center gap-2.5 cursor-pointer ${
                locale === l.code
                  ? 'bg-brand/10 text-brand font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <CountryFlag code={l.code} className="w-5 h-3.5 rounded-[2px] ring-1 ring-gray-300 shrink-0" />
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
