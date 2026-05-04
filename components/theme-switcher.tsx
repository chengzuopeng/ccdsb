'use client';

import { useTheme } from '@/lib/theme/context';
import { useI18n } from '@/lib/i18n/context';
import type { Theme } from '@/lib/theme/shared';

const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };

export function ThemeSwitcher() {
  const { theme, resolved, setTheme } = useTheme();
  const { t } = useI18n();
  const next = NEXT[theme];

  return (
    <button
      onClick={() => setTheme(next)}
      className="h-7 w-9 inline-flex items-center justify-center rounded-md border border-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-surface-hi hover:border-border-hi transition-colors"
      title={`${t('theme.label')}: ${t(`settings.theme.${theme}`)} (${resolved}) → ${t(`settings.theme.${next}`)}`}
      aria-label={t('theme.label')}
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'light') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}
