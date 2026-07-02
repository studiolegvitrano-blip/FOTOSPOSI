import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['it', 'en-US', 'en-GB', 'de', 'fr', 'es'],
  defaultLocale: 'it',
  localePrefix: 'never',
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
