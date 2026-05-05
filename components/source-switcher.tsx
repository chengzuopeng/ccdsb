'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useT, useI18n } from '@/lib/i18n/context';
import type { ProviderId } from '@/lib/providers/types';

interface ProviderInfo {
  id: ProviderId;
  shortLabel: string;
  fg: string;
  bg: string;
  displayEn: string;
  displayZh: string;
}

interface Props {
  available: ProviderId[];
  initial: ProviderId;
  providers: ProviderInfo[];
}

const COOKIE_NAME = 'ccgauge_source';

function setCookie(value: string) {
  if (typeof document === 'undefined') return;
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

function deepLinkRoute(pathname: string): boolean {
  return /^\/sessions\/[^/]+|^\/projects\/[^/]+/.test(pathname);
}

export function SourceSwitcher({ available, initial, providers }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT();
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const urlSource = searchParams.get('source') as ProviderId | null;
  const [current, setCurrent] = useState<ProviderId>(urlSource ?? initial);

  useEffect(() => {
    if (urlSource && urlSource !== current) setCurrent(urlSource);
  }, [urlSource, current]);

  if (available.length < 2) return null;

  const select = (id: ProviderId) => {
    if (id === current) return;
    setCurrent(id);
    setCookie(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('source', id);
    const target = deepLinkRoute(pathname)
      ? `/${pathname.split('/')[1]}?${params.toString()}`
      : `${pathname}?${params.toString()}`;
    startTransition(() => {
      router.push(target);
    });
  };

  return (
    <div
      role="group"
      aria-label={t('nav.source')}
      className="inline-flex items-center rounded-md border border-border bg-bg-surface p-0.5 gap-0.5"
      title={t('nav.source')}
    >
      {providers
        .filter((p) => available.includes(p.id))
        .map((p) => {
          const isActive = p.id === current;
          const label = locale === 'zh' ? p.displayZh : p.displayEn;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => select(p.id)}
              aria-pressed={isActive}
              disabled={pending}
              className={`px-2.5 h-6 text-xs inline-flex items-center gap-1.5 rounded transition-all ${
                isActive
                  ? 'bg-brand text-white font-semibold shadow-sm ring-1 ring-brand/40'
                  : 'text-text-tertiary font-medium hover:text-text-primary hover:bg-bg-surface-hi'
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px] font-bold leading-none ${
                  isActive ? 'ring-1 ring-white/40' : ''
                }`}
                style={{ background: p.bg, color: p.fg }}
              >
                {p.shortLabel}
              </span>
              <span>{label}</span>
            </button>
          );
        })}
    </div>
  );
}
