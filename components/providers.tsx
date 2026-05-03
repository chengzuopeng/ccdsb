'use client';

import { I18nProvider } from '@/lib/i18n/context';
import { ThemeProvider } from '@/lib/theme/context';
import type { Locale } from '@/lib/i18n/dict';
import type { Theme } from '@/lib/theme/shared';

export function Providers({
  locale,
  theme,
  children,
}: {
  locale: Locale;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <I18nProvider initialLocale={locale}>
      <ThemeProvider initialTheme={theme}>{children}</ThemeProvider>
    </I18nProvider>
  );
}
