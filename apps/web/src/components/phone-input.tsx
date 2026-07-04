'use client';

import { useLocale } from 'next-intl';

export interface CountryDialCode {
  code: string; // ISO country code
  dial: string; // e.g. "+39"
  flag: string;
  name: string;
}

// Ordered with the locale-relevant countries first, then a broad set of other countries so
// guests/couples anywhere in the world can still find their own prefix by scrolling.
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { code: 'IT', dial: '+39', flag: '🇮🇹', name: 'Italia' },
  { code: 'US', dial: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'GB', dial: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'DE', dial: '+49', flag: '🇩🇪', name: 'Deutschland' },
  { code: 'FR', dial: '+33', flag: '🇫🇷', name: 'France' },
  { code: 'ES', dial: '+34', flag: '🇪🇸', name: 'España' },
  { code: 'CH', dial: '+41', flag: '🇨🇭', name: 'Schweiz/Suisse' },
  { code: 'AT', dial: '+43', flag: '🇦🇹', name: 'Österreich' },
  { code: 'PT', dial: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: 'NL', dial: '+31', flag: '🇳🇱', name: 'Nederland' },
  { code: 'BE', dial: '+32', flag: '🇧🇪', name: 'Belgique/België' },
  { code: 'IE', dial: '+353', flag: '🇮🇪', name: 'Ireland' },
  { code: 'CA', dial: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'AU', dial: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: 'BR', dial: '+55', flag: '🇧🇷', name: 'Brasil' },
  { code: 'MX', dial: '+52', flag: '🇲🇽', name: 'México' },
  { code: 'AR', dial: '+54', flag: '🇦🇷', name: 'Argentina' },
  { code: 'IN', dial: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'CN', dial: '+86', flag: '🇨🇳', name: 'China' },
  { code: 'JP', dial: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: 'RO', dial: '+40', flag: '🇷🇴', name: 'România' },
  { code: 'PL', dial: '+48', flag: '🇵🇱', name: 'Polska' },
  { code: 'GR', dial: '+30', flag: '🇬🇷', name: 'Ελλάδα' },
  { code: 'SE', dial: '+46', flag: '🇸🇪', name: 'Sverige' },
];

function defaultDialForLocale(locale: string): string {
  if (locale === 'it') return '+39';
  if (locale === 'en-GB') return '+44';
  if (locale === 'de') return '+49';
  if (locale === 'fr') return '+33';
  if (locale === 'es') return '+34';
  return '+1'; // en-US and fallback
}

interface PhoneInputProps {
  dial: string;
  onDialChange: (dial: string) => void;
  number: string;
  onNumberChange: (number: string) => void;
  required?: boolean;
}

export function usePhoneDefaultDial(): string {
  const locale = useLocale();
  return defaultDialForLocale(locale);
}

export function PhoneInput({ dial, onDialChange, number, onNumberChange, required }: PhoneInputProps) {
  return (
    <div className="flex gap-2">
      <select
        value={dial}
        onChange={(e) => onDialChange(e.target.value)}
        className="rounded-md border border-border bg-white px-2 py-2 text-sm w-[92px] shrink-0"
        aria-label="Prefisso internazionale"
      >
        {COUNTRY_DIAL_CODES.map((c) => (
          <option key={`${c.code}-${c.dial}`} value={c.dial}>
            {c.flag} {c.dial}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        value={number}
        onChange={(e) => onNumberChange(e.target.value.replace(/[^0-9\s]/g, ''))}
        placeholder="333 1234567"
        required={required}
        className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm"
      />
    </div>
  );
}
