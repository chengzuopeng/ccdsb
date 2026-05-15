# Marketing site images

This directory holds every static image the marketing site renders.

## Current state

The homepage and feature tour now use real product screenshots plus generated
feature artwork:

- `screenshots/*.png` are real dashboard captures copied from
  `../../docs/screenshots/`.
- `feature-*.webp` are generated feature-card images for CLI, MCP, privacy,
  i18n, and the activity heatmap.
- `og-default.png` and `og-cli.png` are generated 1200 x 630 social cards.

The legacy `*.svg` files are old placeholders from
[`../../scripts/gen-placeholders.mjs`](../../scripts/gen-placeholders.mjs).
They are kept only as fallback/reference assets and should not be used by
production pages.

## Refresh workflow

1. Re-run the dashboard screenshot script from the repo root:
   `pnpm screenshots`.
2. Copy refreshed PNGs into `site/public/images/screenshots/`.
3. Regenerate any changed feature artwork, export WebP at 16:10, and update the
   matching `imageSrc` reference in `site/src/pages/`.
4. Rebuild the site with `pnpm -C site build`.

## Prompt catalogue

All generated feature prompts target a restrained dark product aesthetic:
near-black background, indigo/emerald accents, crisp UI shapes, no logos, no
watermarks, and no readable placeholder text.

### `hero-dashboard` — 1600 × 1000 (16:10)

> Minimalist isometric data dashboard floating in dark space, near-black
> background `#0A0A0A`, indigo (#818CF8) accent glows, soft chart bars and
> a 7×24 heatmap grid visible, subtle violet ambient lighting, depth-of-
> field blur on edges, ultra-clean geometric tech-illustration style
> reminiscent of Vercel / Linear marketing art, no text, no logos, no
> readable numbers, 16:10 cinematic composition, premium SaaS aesthetic.

### `feature-dashboard` — 1600 × 1000

**Recommendation:** skip the generation step. Crop a high-resolution
`docs/screenshots/overview-en-dark.png` to 16:10 and save as
`feature-dashboard.webp`. Real product screenshots beat illustrations for
this card.

If you do want a generated version:

> Stylized rendering of an analytics dashboard on a near-black background,
> indigo (#818CF8) bar-chart accents, KPI tile mockups in the top row,
> trend chart in the middle, soft glow, no readable text, premium SaaS
> marketing aesthetic.

### `feature-cli` — 1600 × 1000

> Stylized macOS terminal window centered on near-black background
> `#0A0A0A`, indigo (#818CF8) cursor and accent, white and muted-gray
> monospace text characters in abstract not-quite-readable form, a small
> ASCII-art horizontal bar chart inside the terminal with indigo bars,
> subtle indigo glow under the window, flat-vector aesthetic, minimal
> shadows, no real readable copy, premium dev-tool marketing illustration.

### `feature-mcp` — 1600 × 1000

> Abstract network diagram: three glowing indigo (#818CF8) nodes
> connected by thin curved lines on a near-black canvas, central node
> larger with a subtle pulse glow, two outer nodes labelled with abstract
> glyphs (no readable text), geometric and clean, technical-illustration
> style reminiscent of Stripe and Linear marketing art, soft volumetric
> lighting, no logos.

### `feature-codex` — 1600 × 1000

(Currently unused on the homepage — feature card uses a different image.
Keep this prompt handy in case you re-add a "Codex + Claude duality"
card later.)

> Two abstract token streams flowing in parallel from left to right — one
> indigo (#818CF8), one warm orange (#FB923C) — converging into a single
> small bar chart on the right, near-black background `#0A0A0A`,
> isometric perspective, soft volumetric light, minimalist editorial-
> illustration style, no text or readable logos, premium tech aesthetic.

### `feature-privacy` — 1600 × 1000

> Translucent indigo (#818CF8) shield icon overlaid on a stylized solid-
> state drive silhouette, near-black background, soft indigo glow
> underneath, geometric isometric design, no network arrows leaving the
> drive, no telemetry beams, clean minimalist tech-illustration
> aesthetic, premium "privacy by design" visual.

### `feature-i18n` — 1600 × 1000

> Two stacked browser-window mockups on near-black background — top
> window shows abstract Latin character blocks in indigo (#818CF8),
> bottom window shows abstract CJK character blocks in the same indigo,
> the two windows linked by a thin indigo curved arc, minimalist
> geometric style, soft glow, no readable text, premium
> internationalisation aesthetic.

### `og-default` — 1200 × 630 (social card)

Social-media crawlers DO NOT render SVG OG images. Replace this one with
a real **PNG** for sharing previews.

> Social media share card, near-black `#0A0A0A` background, large bold
> sans-serif word "ccgauge" centered-left in pure white, small indigo
> (#818CF8) chart-icon glyph to the immediate left of the word, an indigo
> bar-chart silhouette fading into the right edge, generous padding
> (~80 px), premium SaaS marketing aesthetic à la Vercel / Linear OG
> images, 1200×630 dimensions.

### `og-cli` — 1200 × 630 (social card)

> Social card 1200×630, near-black background, stylized terminal prompt
> `$ ccgauge report` rendered in white monospace centered, blinking
> indigo (#818CF8) cursor at the end, a small horizontal bar-chart
> graphic beneath the command in indigo, premium minimalist dev-tool
> aesthetic.

## Aspect-ratio reference

| Use | Aspect | Export size |
|---|---|---|
| Hero | 16:10 | 1600 × 1000 |
| Feature card | 16:10 | 1600 × 1000 |
| OG / Twitter card | 1.91:1 | 1200 × 630 |
| Screenshot frame | matches source | 2880 × 1800 (retina) |

## Notes

- The placeholders are generated — never edit them by hand. If you want a
  different stand-in, edit `scripts/gen-placeholders.mjs` and re-run it.
- The script is also wired up as a manual recipe in `site/package.json`
  via `pnpm gen:placeholders` for convenience.
- Keep total `public/images/` under ~2 MB once real images land — large
  hero artwork should be served as WebP at 75-85 quality.
