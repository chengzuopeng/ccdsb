'use client';

import { useI18n } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/dict';

const LABEL: Record<Locale, string> = { en: 'EN', zh: '中' };
const NEXT: Record<Locale, Locale> = { en: 'zh', zh: 'en' };
const FULL: Record<Locale, string> = { en: 'English', zh: '中文' };

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const next = NEXT[locale];
  return (
    <button
      onClick={() => setLocale(next)}
      className="h-7 w-9 inline-flex items-center justify-center rounded-md border border-border bg-bg-surface text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface-hi hover:border-border-hi transition-colors"
      title={`${t('lang.label')}: ${FULL[locale]} → ${FULL[next]}`}
      aria-label={t('lang.label')}
    >
      {LABEL[locale]}
    </button>
  );
}
