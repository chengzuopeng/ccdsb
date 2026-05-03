'use client';

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { LOCALES, type Locale } from '@/lib/i18n/dict';
import { cn } from '@/lib/utils';

const LABEL: Record<Locale, string> = { en: 'EN', zh: '中' };
const FULL: Record<Locale, string> = { en: 'English', zh: '中文' };

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-ghost px-2 py-1 text-xs font-medium"
        title={t('lang.label')}
        aria-label={t('lang.label')}
      >
        {LABEL[locale]}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 min-w-[8rem] card border-border-hi shadow-lg p-1 z-30">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={cn(
                'w-full text-left px-2.5 py-1.5 text-sm rounded hover:bg-bg-surface-hi flex items-center gap-2',
                locale === l && 'text-text-primary',
              )}
            >
              <span
                className={cn(
                  'w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px]',
                  locale === l ? 'bg-brand border-brand text-white' : 'border-border-hi',
                )}
              >
                {locale === l ? '✓' : ''}
              </span>
              <span>{FULL[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
