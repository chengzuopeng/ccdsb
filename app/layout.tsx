import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Nav } from '@/components/nav';
import { Providers } from '@/components/providers';
import { NoFlashScript } from '@/components/no-flash-script';
import { getServerLocale } from '@/lib/i18n/server';
import { getServerTheme } from '@/lib/theme/server';
import { tFn } from '@/lib/i18n/dict';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  return {
    title: 'ccgauge — Claude Code Dashboard',
    description: tFn(locale, 'brand.tagline'),
    icons: {
      icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
      shortcut: '/favicon.svg',
      apple: '/favicon.svg',
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();
  const theme = await getServerTheme();
  // Server emits the resolved class so SSR colors look right; the inline
  // NoFlashScript fixes it up immediately for users whose preference differs.
  const initialClass = theme === 'light' ? 'theme-light' : 'theme-dark';

  return (
    <html lang={locale === 'zh' ? 'zh-CN' : 'en'} className={initialClass} suppressHydrationWarning>
      <head>
        <NoFlashScript />
      </head>
      <body className="min-h-screen bg-bg text-text-primary">
        <Providers locale={locale} theme={theme}>
          <Nav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
