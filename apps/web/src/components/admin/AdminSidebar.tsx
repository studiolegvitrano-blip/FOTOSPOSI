'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type NavItem = {
  href: string;
  label: string;
  title: string;
  icon: string;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { href: '/admin', label: 'Home', title: 'Pannello di gestione', icon: 'home', exact: true },
  { href: '/admin/system', label: 'Sistema', title: 'Stato di sistema — code, cron, DLQ', icon: 'pulse' },
  { href: '/admin/storage', label: 'Storage', title: 'Diagnostica storage — pending/orfani R2 + azioni Forza/Cancella', icon: 'drive' },
  { href: '/admin/orders', label: 'Ordini', title: 'Ordini IBAN in attesa di conferma', icon: 'cart' },
  { href: '/admin/marketplace', label: 'Fornitori', title: 'Marketplace — candidature e fornitori approvati', icon: 'store' },
  { href: '/admin/affiliates', label: 'Collaboratori', title: 'Affiliates — influencer e provvigioni', icon: 'users' },
  { href: '/admin/coupons', label: 'Coupon', title: 'Coupon sconto', icon: 'ticket' },
  { href: '/admin/analytics', label: 'Analytics', title: 'Analytics aggregate', icon: 'chart' },
  { href: '/admin/leads', label: 'Lead B2B', title: 'Lead B2B in attesa di contatto', icon: 'target' },
];

function Icon({ name, className }: { name: string; className?: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };
  switch (name) {
    case 'home':
      return (
        <svg {...common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
      );
    case 'pulse':
      return (
        <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
      );
    case 'cart':
      return (
        <svg {...common}><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.5 3h2l3.6 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
      );
    case 'store':
      return (
        <svg {...common}><path d="M3 9 4 4h16l1 5" /><path d="M5 9v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9" /><path d="M9 22V12h6v10" /></svg>
      );
    case 'users':
      return (
        <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      );
    case 'ticket':
      return (
        <svg {...common}><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" /></svg>
      );
    case 'chart':
      return (
        <svg {...common}><path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" /></svg>
      );
    case 'target':
      return (
        <svg {...common}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
      );
    case 'drive':
      return (
        <svg {...common}><path d="M4 4h16v12H4z" /><path d="M8 20h8" /><path d="M12 16v4" /></svg>
      );
    default:
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /></svg>
      );
  }
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

export function AdminSidebar() {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);

  const links = NAV.map((item) => {
    const active = isActive(pathname, item);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.title}
        onClick={() => setOpen(false)}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          active
            ? 'bg-brand text-white shadow-sm'
            : 'text-text hover:bg-muted',
        )}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </Link>
    );
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md bg-surface"
        aria-label="Apri menu di navigazione"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
        <span>Menu</span>
      </button>

      <aside
        className={cn(
          'md:sticky md:top-4 md:self-start md:block w-full',
          open ? 'block' : 'hidden',
        )}
      >
        <div className="md:rounded-md md:border md:border-border md:bg-surface md:p-3 space-y-1">
          <div className="hidden md:flex items-center justify-between px-2 pb-2 mb-1 border-b border-border">
            <span className="text-xs uppercase tracking-wider text-text-muted">Admin</span>
          </div>
          <div className="flex flex-col gap-1">{links}</div>
          <div className="hidden md:block pt-2 mt-2 border-t border-border">
            <form action="/api/ceo/logout" method="POST">
              <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                <span>Esci</span>
              </Button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
