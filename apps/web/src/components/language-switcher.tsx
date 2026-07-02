'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';

const locales = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export default function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(code: string) {
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    router.refresh();
  }

  return (
    <div className="relative group">
      <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <Globe size={16} />
        <span className="hidden sm:inline">{locale}</span>
      </button>
      <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-1 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        {locales.map((l) => (
          <button
            key={l.code}
            onClick={() => switchLocale(l.code)}
            className={`w-full text-left px-3 py-1.5 text-sm rounded-md flex items-center gap-2 cursor-pointer ${
              locale === l.code
                ? 'bg-brand/10 text-brand font-medium'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{l.flag}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
