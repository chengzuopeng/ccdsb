'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/lib/theme/context';
import { useI18n } from '@/lib/i18n/context';
import type { Theme } from '@/lib/theme/shared';
import { cn } from '@/lib/utils';

const ICONS: Record<Theme, string> = { light: '☀', dark: '☾', system: '◐' };

export function ThemeSwitcher() {
  const { theme, resolved, setTheme } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const options: { value: Theme; label: string }[] = [
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
    { value: 'system', label: t('settings.theme.system') },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="btn-ghost px-2 py-1 text-base leading-none"
        title={`${t('theme.label')}: ${theme} (${resolved})`}
        aria-label={t('theme.label')}
      >
        <span aria-hidden>{ICONS[theme]}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 min-w-[8rem] card border-border-hi shadow-lg p-1 z-30">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                setTheme(o.value);
                setOpen(false);
              }}
              className={cn(
                'w-full text-left px-2.5 py-1.5 text-sm rounded hover:bg-bg-surface-hi flex items-center gap-2',
                theme === o.value && 'text-text-primary',
              )}
            >
              <span className="w-4 text-center" aria-hidden>{ICONS[o.value]}</span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
