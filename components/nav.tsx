'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';

const ITEMS = [
  { href: '/', tk: 'nav.overview', exact: true },
  { href: '/usage', tk: 'nav.usage' },
  { href: '/sessions', tk: 'nav.sessions' },
  { href: '/projects', tk: 'nav.projects' },
  { href: '/models', tk: 'nav.models' },
  { href: '/settings', tk: 'nav.settings' },
];

export function Nav() {
  const pathname = usePathname();
  const t = useT();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg-base/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-button bg-brand text-white text-xs font-bold">
            cc
          </span>
          <span>ccgauge</span>
          <span className="text-xs text-text-tertiary font-normal hidden md:inline">{t('brand.tagline')}</span>
        </Link>
        <nav className="flex-1 flex items-center gap-1">
          {ITEMS.map((it) => {
            const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + '/');
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-button font-medium transition-colors',
                  active
                    ? 'text-text-primary bg-bg-surface-hi'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface',
                )}
              >
                {t(it.tk)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          <span className="pill bg-bg-surface-hi text-text-tertiary text-[10px] uppercase tracking-wide">
            {t('nav.localBadge')}
          </span>
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
