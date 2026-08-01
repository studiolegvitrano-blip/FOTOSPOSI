'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { getCalendarLinks } from '@fotosposi/site-builder';
import { useTranslations } from 'next-intl';

interface AddToCalendarMenuProps {
  date: string;
  time: string;
  title: string;
  address?: string;
  note?: string;
  durationMinutes?: number;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function AddToCalendarMenu({
  date,
  time,
  title,
  address,
  note,
  durationMinutes = 120,
  variant = 'default',
  size = 'sm',
  className = '',
}: AddToCalendarMenuProps) {
  const t = useTranslations('calendar_menu');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!date || !time) return null;
  const links = getCalendarLinks({ date, time, title, address, note, durationMinutes });

  const variantClasses = {
    default: 'bg-brand text-white hover:opacity-90',
    outline: 'border border-border bg-surface hover:bg-muted',
    ghost: 'hover:bg-muted',
  }[variant];

  const sizeClasses = {
    default: 'px-4 py-2 text-sm',
    sm: 'px-3 py-1.5 text-xs',
    lg: 'px-6 py-3 text-base',
  }[size];

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-colors ${variantClasses} ${sizeClasses}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Calendar className="w-4 h-4" />
        {t('add_to_calendar')}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-56 rounded-md border border-border bg-surface shadow-lg z-50 overflow-hidden"
        >
          <a
            href={links.google}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <GoogleIcon /> {t('google')}
          </a>
          <a
            href={links.outlook}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors border-t border-border"
          >
            <OutlookIcon /> {t('outlook')}
          </a>
          <a
            href={links.ics}
            download="matrimonio.ics"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors border-t border-border"
          >
            <AppleIcon /> {t('apple')}
          </a>
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#0078D4" d="M11.5 3v4.5H22v9H11.5V21L1 17.25V6.75L11.5 3z" />
      <path fill="#fff" d="M5.5 9.5h3v5h-3z" opacity="0.95" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="currentColor" d="M16.36 12.45c-.02-2.04 1.67-3.02 1.74-3.07-.95-1.39-2.43-1.58-2.95-1.6-1.26-.13-2.46.74-3.1.74-.64 0-1.62-.72-2.66-.7-1.37.02-2.64.8-3.35 2.03-1.43 2.48-.36 6.15 1.02 8.17.68.99 1.49 2.1 2.55 2.06 1.02-.04 1.41-.66 2.65-.66 1.23 0 1.58.66 2.66.64 1.1-.02 1.79-1 2.46-1.99.78-1.14 1.1-2.24 1.12-2.3-.02-.01-2.15-.83-2.17-3.27z" />
      <path fill="currentColor" d="M14.4 6.15c.56-.69.94-1.64.84-2.59-.81.03-1.79.54-2.37 1.22-.52.6-.97 1.57-.85 2.5.9.07 1.82-.46 2.38-1.13z" />
    </svg>
  );
}
