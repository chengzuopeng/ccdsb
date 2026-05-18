'use client';

import { useI18n } from '@/lib/i18n/context';
import { LOCALES, type Locale } from '@/lib/i18n/dict';

const LABEL: Record<Locale, string> = { en: 'EN', zh: '中' };
const FULL: Record<Locale, string> = { en: 'English', zh: '中文' };

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      role="group"
      className="inline-flex items-center rounded-md border border-border bg-bg-surface p-0.5 text-xs"
      title={t('lang.label')}
      aria-label={t('lang.label')}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => {
              if (!active) setLocale(l);
            }}
            className={`px-2 py-1 rounded transition-colors ${
              active
                ? 'bg-brand-strong text-white font-semibold'
                : 'text-text-tertiary hover:text-text-primary hover:bg-bg-surface-hi'
            }`}
            title={FULL[l]}
            aria-pressed={active}
          >
            {LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
