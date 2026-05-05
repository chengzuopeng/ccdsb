'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Logo } from '@/components/logo';
import { SourceSwitcher } from '@/components/source-switcher';
import type { ProviderId } from '@/lib/providers/types';

const ITEMS = [
  { href: '/', tk: 'nav.overview', exact: true },
  { href: '/usage', tk: 'nav.usage' },
  { href: '/sessions', tk: 'nav.sessions' },
  { href: '/projects', tk: 'nav.projects' },
  { href: '/models', tk: 'nav.models' },
  { href: '/settings', tk: 'nav.settings' },
];

interface ProviderInfo {
  id: ProviderId;
  shortLabel: string;
  fg: string;
  bg: string;
  displayEn: string;
  displayZh: string;
}

interface Props {
  availableProviders: ProviderId[];
  initialSource: ProviderId;
  providerInfos: ProviderInfo[];
}

export function Nav({ availableProviders, initialSource, providerInfos }: Props) {
  const pathname = usePathname();
  const t = useT();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg-base/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center gap-2 sm:gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap shrink-0"
          aria-label="ccgauge home"
        >
          <Logo className="w-7 h-7" />
          <span className="hidden xs:inline sm:inline">ccgauge</span>
          <span className="text-xs text-text-tertiary font-normal hidden lg:inline">
            {t('brand.tagline')}
          </span>
        </Link>
        <nav
          className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto scrollbar-thin"
          aria-label="Primary"
        >
          {ITEMS.map((it) => {
            const active = it.exact
              ? pathname === it.href
              : pathname === it.href || pathname.startsWith(it.href + '/');
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'px-2.5 sm:px-3 py-1.5 text-sm rounded-button font-medium transition-colors whitespace-nowrap shrink-0',
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
        <div className="flex items-center gap-2 shrink-0">
          <SourceSwitcher
            available={availableProviders}
            initial={initialSource}
            providers={providerInfos}
          />
          <span className="pill bg-bg-surface-hi text-text-tertiary text-[10px] uppercase tracking-wide hidden md:inline-flex">
            {t('nav.localBadge')}
          </span>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
