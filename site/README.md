# ccgauge marketing site

The product website at `ccgauge.dev` (and on whichever static host you
deploy this to). Built with [Astro 4](https://astro.build) + Tailwind v3,
bilingual (English + 简体中文), with full dark/light theme support and
zero JS framework runtime.

This directory is **independent** from the npm-published `ccgauge`
package. It has its own `package.json`, its own lockfile, and is excluded
from the npm tarball via the main repo's `package.json#files` allowlist
(plus a `site/` line in `.npmignore` as belt-and-suspenders).

## Develop

```bash
pnpm install
pnpm dev                # http://localhost:4321
```

The dashboard (Next.js, in the parent repo) lives on `:3738` in dev, so
the two can run side by side without port collisions.

## Build & preview

```bash
pnpm build              # outputs to ./dist
pnpm preview            # serves ./dist on :4322
```

## Project layout

```
site/
├─ astro.config.mjs           # i18n, integrations, site URL
├─ tailwind.config.cjs        # mirrors the dashboard's design tokens
├─ tsconfig.json
├─ scripts/
│  └─ gen-placeholders.mjs    # branded SVG placeholders for hero/feature/og
├─ public/
│  ├─ favicon.svg             # copied from main repo
│  ├─ robots.txt
│  └─ images/                 # placeholders + real screenshots
│     ├─ README.md            # image-replacement workflow + AI prompts
│     ├─ *.svg                # placeholders (replace with real WebP/PNG)
│     └─ screenshots/
│        └─ overview-*.png    # real dashboard captures
└─ src/
   ├─ consts.ts               # site title / URL / locale tuple / theme key
   ├─ env.d.ts
   ├─ styles/global.css       # tailwind directives + CSS-var design tokens
   ├─ i18n/
   │  ├─ ui.ts                # shared short strings (nav, CTAs, footer)
   │  └─ utils.ts              # useTranslations / switchLocaleUrl / localePath
   ├─ layouts/
   │  └─ BaseLayout.astro      # <head> + nav + footer + no-flash theme script
   ├─ components/              # Nav / Footer / LangSwitch / ThemeToggle / …
   └─ pages/
      ├─ index.astro           # 302 → /en/
      ├─ en/                   # 5 pages: home, features, cli, mcp, privacy
      └─ zh/                   # mirror
```

## Internationalisation

- `astro.config.mjs` uses Astro's built-in i18n with
  `defaultLocale: 'en'`, `prefixDefaultLocale: true`. The root `/`
  redirects to `/en/`.
- Short reusable strings live in `src/i18n/ui.ts` (English + 中文).
- Long-form page copy is **inline** per `.astro` file — easier to scan
  one document than to grep across a translation table.
- The `<LangSwitch>` component preserves the current path segment when
  flipping between locales (`/en/cli/` ↔ `/zh/cli/`).

## Theming

- Three-state theme cycler: dark → light → system. Persisted to
  `localStorage` under `ccgauge.site.theme` (prefix `.site.` so it
  doesn't collide with the dashboard's `ccgauge.theme`).
- An inline no-flash `<script>` in `BaseLayout.astro` applies the
  matching `<html class>` before paint.
- CSS variables in `src/styles/global.css` mirror the main dashboard's
  Indigo palette so transitioning between marketing site and product
  feels seamless.

## Images

See [`public/images/README.md`](./public/images/README.md) for:

- the **complete file inventory** (which page uses which screenshot or
  generated card)
- the **AI-generation prompt catalogue** for every `feature-*.webp` and
  `og-*.png`
- the **refresh workflow** for screenshots and OG art

Quickest path when the dashboard UI changed and the marketing screenshots
look stale:

```bash
# From repo root, regenerate dashboard screenshots (Playwright):
pnpm screenshots

# Copy them into the site, then rebuild:
cp docs/screenshots/*.png site/public/images/screenshots/
pnpm -C site build
```

To re-generate the legacy placeholder SVGs (rarely needed — the site
ships real WebP / PNG now):

```bash
pnpm gen:placeholders
```

## Deploy

Recommended: **Cloudflare Pages**.

- Connect the GitHub repo, set "Build directory" = `site`,
  "Build command" = `pnpm install && pnpm build`,
  "Output" = `site/dist`.
- DNS the chosen domain (e.g. `ccgauge.dev`) at Cloudflare.
- Update `astro.config.mjs#site` and `src/consts.ts#SITE_URL` to the real
  domain so canonical / OG meta tags are correct.

Alternatives: Vercel, Netlify, GitHub Pages — all support sub-directory
builds with a one-line config.

## Why this isn't part of the npm package

The npm tarball is ~7 MB and contains only the dashboard + CLI + MCP
runtime. Shipping marketing-site source code, build dependencies, and
~13 MB of placeholder / generated artwork would bloat install times for
every user who only wants to run `npx ccgauge`. The main repo's
`package.json#files` whitelists exactly what publishes; `site/` is not
on that list.
