# Changelog

All notable changes to **ccgauge** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] — 2026-05-05

### Fixed

- README screenshots and the English ↔ 简体中文 cross-link now use
  absolute GitHub URLs so the npm package page renders the hero image
  inline and the language switcher no longer 404s. Relative paths only
  resolve on GitHub, not on `npmjs.com`.

### Added

- `repository`, `homepage`, `bugs`, and `author` fields in
  `package.json` so the npm sidebar links back to GitHub Issues / repo
  / maintainer profile.

## [0.3.0] — 2026-05-05

This release adds **OpenAI Codex CLI** as a first-class data source alongside
Claude Code, ships a background-indexed data layer for instant page
navigation, and overhauls the `/usage` page so it no longer ships megabytes
of HTML to the browser.

### Added

- **Multi-provider support.** New `lib/providers/` adapter layer; toggle
  between **Claude Code** and **OpenAI Codex CLI** from the nav bar.
  Source persists via `?source=` URL param + cookie. Adding a third
  provider is a single new file plus a one-line registry entry.
- **Background indexer** (`lib/data-loader/indexer.ts`) — `fs.watch`-driven,
  with a 30 s polling fallback and per-file `mtime+size` deduplication.
  Pages now read an in-memory snapshot in O(1) instead of triggering a
  scan on every navigation.
- **Persisted index** at `~/.ccgauge/cache/index-vN.json`, with schema
  versioning and per-entry `parserVersion` so semantic parser fixes
  auto-invalidate stale records on the next startup. Restart goes from
  ~750 ms full scan to ~110 ms cache restore.
- **Server-side pagination** for `/usage`. URL-driven search / sort /
  page; only the current page's 25 turns are sent to the client.
  Real-data HTML payload drops from **~3.58 MB to ~40 KB** (89× smaller).
- **Streaming CSV export** (`/api/export/usage`) with formula-injection
  guard (escapes leading `=`, `+`, `-`, `@`).
- **Source switcher** in the nav with brand-coloured active state, plus
  `prefetch={false}` on tabs so opening the dashboard doesn't preload
  every heavy page.
- **`reasoning_tokens` breakdown** surfaced in token-total hover cards and
  the session timeline, so OpenAI users can see how much of their output
  was reasoning (typically the dominant cost driver).
- **Indexer status panel** in **Settings**: last indexed at, index
  duration, active watchers, loaded-from-disk flag, recent errors.
- **Unified API error handler** (`lib/api/error-handler.ts`) — every
  route returns structured JSON 500 with a sanitized message instead of
  HTML stack pages. Indexer errors leaked through `/api/scan` are
  scrubbed of `$HOME` paths.
- **Codex parser smoke test** (`pnpm test`) covering token-count
  semantics, parser version, reasoning-detail emission, and pricing.

### Changed

- **Brand colour** moved from Anthropic orange to Indigo so the
  dashboard's chrome doesn't clash with the (warm) Claude / Codex
  per-provider chips.
- **Overview header counts** now reflect the **active source** instead
  of mixing Claude + Codex global totals.
- **Codex parser** rewritten to derive each emitted record's tokens
  from the forward delta of `total_token_usage`, fixing a ~26 %
  over-count caused by duplicate / refresh `token_count` events
  (Codex now bills $134.63 instead of $165.63 for the same 70-file
  dataset).
- **Output token convention** for Codex: `output_tokens` includes
  reasoning tokens (matches OpenAI Responses API billing); reasoning
  is exposed separately as a display-only breakdown that does not
  double-count.
- **Codex parser timestamp fallback chain** (event → session_meta →
  last valid → file mtime → now) so events without a timestamp don't
  break sort or time bucketing.
- **Internationalised settings** with Codex / Claude data source
  display names, indexer status keys, and reasoning breakdown labels.

### Fixed

- **Nav bar shake on tab switch.** `html { overflow-y: scroll }` reserves
  the scrollbar gutter so navigations between short and tall pages no
  longer shift the centred nav horizontally.
- **`forceRescan` race condition.** Concurrent `POST /api/scan` calls
  are now coalesced onto a single in-flight Promise, so the in-memory
  index Map can't be wiped mid-scan.
- **Provider root not detected post-startup.** The poll loop re-detects
  data directories every 30 s, so a Codex/Claude install that appears
  after launch is picked up automatically.
- **Search debounce leak** — `UsageTable` clears its pending `router.push`
  timer on unmount so navigating away mid-typing doesn't yank you back
  to `/usage`.
- **`?page=NaN` / non-numeric inputs** were rendering an undefined page.
  Strict `Number.isFinite` guard, falls back to page 1.
- **`stats.durationMs` was misleading** after the indexer split work
  across phases. It now reflects the wall-clock from work start to
  snapshot ready.
- **Fast Refresh resets** during dev: indexer instance is stored on
  `globalThis` so HMR doesn't re-scan on every code save.

### Security

- **CSV formula injection guard** in `/api/export/usage`: cells starting
  with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with `'` so
  spreadsheet apps render them as text instead of executing as formulas.
- **Path sanitisation** in indexer error history: absolute paths
  containing the OS username are rewritten to `~` before being exposed
  via `/api/scan` and the Settings UI.

### Performance

| Metric                         | Before         | After      |
| ------------------------------ | -------------- | ---------- |
| `/usage?codex&all` HTML        | 3.58 MB        | **40 KB**  |
| `/usage?claude&7d` HTML        | 1.57 MB        | **34 KB**  |
| TTFB (warm)                    | 36–57 ms       | **15–19 ms** |
| Cold start with persisted cache | 747 ms (rescan) | **110 ms (restore)** |

## [0.2.0] — 2026-04-30

- One-click language + theme toggles refined in the header.
- Internal site-wide UX cleanup ahead of multi-provider support.

## [0.1.x]

- Initial public release as `ccgauge`: local Next.js dashboard for
  Claude Code token usage, cost, and 5-hour block tracking.

[0.3.1]: https://github.com/chengzuopeng/ccgauge/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/chengzuopeng/ccgauge/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/chengzuopeng/ccgauge/compare/v0.1.1...v0.2.0
