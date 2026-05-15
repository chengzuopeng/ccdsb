import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  // Replace with the real production domain when ready. Used for:
  //   - canonical / OG meta URLs
  //   - <link rel="alternate"> hreflang URLs in BaseLayout.astro
  site: 'https://ccgauge.dev',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [
    tailwind({ applyBaseStyles: false }),
    // NOTE: @astrojs/sitemap was deliberately omitted. Its 3.7+ releases
    // depend on an `astro:routes:resolved` hook that's only emitted by
    // Astro 5, while we're pinning to Astro 4 for plugin-ecosystem
    // stability. With only 10 generated pages, hand-rolling a static
    // sitemap.xml (or using Cloudflare's auto-sitemap) is cheaper than
    // upgrading the whole stack.
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
    fallback: { zh: 'en' },
  },
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});
