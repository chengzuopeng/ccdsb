# Changelog

All notable changes to **ccgauge** are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] — 2026-05-13

### Fixed

- **Usage table no longer splits a single conversation when a sub-agent is
  invoked.** Claude Code stores each sub-agent invocation in its own
  `<parent-session-uuid>/subagents/agent-*.jsonl` file. The synthesised
  first user record in that file had `parentUuid: null`, breaking the
  chain back to the parent session — so the originating human prompt and
  the sub-agent's work appeared as two separate rows in the usage table,
  with token cost split across both.

  The Claude parser now marks every record with `isSidechain: true` and
  flags the sub-agent's first user as `isSynthetic`. The indexer runs a
  cross-file post-link pass on every snapshot rebuild that re-attaches
  the sub-agent's first user to the parent session's most-recent prior
  assistant. `buildTurnIndex` then walks past the synthetic user and
  groups the sub-agent's assistants under the originating human turn.

  Result: one user prompt = one row in the usage table, regardless of
  how many sub-agents it spawned. Click-to-expand shows all sub-agent
  tool calls inline as children. Cost attribution now correctly bills
  the originating prompt for the full work it triggered.

### Changed

- Claude parser version bumped to `claude-v4-sidechain-merge`. Existing
  persisted index entries with the previous parser version are
  automatically re-parsed on next startup; no manual cache cleanup
  required.

### Internal

- New `lib/data-loader/link-sidechain.ts` — pure function exposing
  `linkSidechainParents()` for testability; called by the indexer's
  `rebuildSnapshotNow`. Idempotent; safe to re-run on every snapshot.
- `AssistantRecord` / `UserRecord` now carry an optional `isSidechain`
  flag (sourced from raw JSONL); useful for future UI markers ("📎
  sub-agent" badge) and for the post-link pass.
- Marketing site scaffold landed under `site/` (Astro + Tailwind,
  bilingual, deploys independently to a static host). Excluded from
  the npm tarball via `.npmignore`.

## [1.0.0] — 2026-05-12

A polish release. Everything from 0.x — Claude + Codex parsers, the web
dashboard, the CLI report, the MCP server — is now considered stable and
documented. Calling it **1.0** to signal feature-complete: the data layer,
the cost math, the turn grouping, and the published-tarball shape are all
settled. Future minor versions will keep the existing surfaces working.

### Highlights

- **Overview "Activity" card** — sessions, messages, total tokens, active
  days, current/longest streak, peak hour, favorite model, plus a 7×24
  day-of-week × hour-of-day heatmap with hover tooltips (messages +
  tokens + share-of-total + share-of-peak). Heat-map cells size to the
  container so the card looks right at any width. Includes a tongue-in-
  cheek "you've used ~N× more tokens than _The Little Prince_" comparison.
- **Conversation-turn grouping handles Skills correctly.** When Claude
  Code invokes a `Skill`, it injects a synthetic `Base directory for this
  skill: ...` user message that previously fragmented a single
  conversation into 2–3 rows in the usage table. We now flag these
  injections (also `<system-reminder>` blocks and `Caveat:` preludes) as
  synthetic — they skip turn-boundary detection but still surface as the
  per-call "prompt" on child rows so you can tell which Skill produced
  each API call.
- **`ccgauge report` (CLI)** — formatted terminal usage report. Tokens +
  Cost summary, trend bar chart, top-N breakdown table, all 0.2 s end to
  end. Supports `--range`, `--source`, `--by model|project|session`,
  `--since/--until`, `--model/--project` filters, `--json` machine
  output, and `--level call|turn` for CSV-style detail.
- **MCP-aware ergonomics.** The Codex parser records the `effort` field
  from `turn_context` and surfaces it in the usage table model column
  (e.g. `GPT-5.2 Codex · high`). The 5h-block card now carries a small
  disclaimer ("wall-clock progress of the 5h window — not your plan
  quota") so users don't confuse our local block tracker with Anthropic's
  actual rate-limit counter.

### Added

- **Activity stats** — `lib/aggregator/activity.ts` computes streaks /
  heat-map / favorite model / token-comparison; rendered by
  `components/activity-stats.tsx` on the overview.
- **Silent auto-refresh on the usage page** — `components/auto-refresh.tsx`
  re-runs the server render every 15 s via `router.refresh()`. No spinner,
  no scroll reset, no search/expand state loss; pauses on hidden tabs.
- **Overview show/hide toggle** on the usage page —
  `components/overview-toggle.tsx` hides the KPI grid + trend chart for
  users who only want the table. State persists to localStorage and is
  applied pre-paint by the no-flash script so collapsed users don't see
  a flash.
- **Token-breakdown popover** in the usage table — hover the total cell
  to see input / output / cache-read / cache-create tokens with their
  per-component cost.
- **Codex `effort` field** plumbed from JSONL → AssistantRecord →
  UsageTableRow → model column display.
- **Per-call "direct prompt"** on child rows — surfaces skill metadata
  (`Base directory for this skill: /Users/.../skills/mf-commit`) on the
  individual API calls inside a Skill block, while the parent turn row
  shows the real human prompt.
- **CSV export overhaul** (`app/api/export/usage/route.ts`):
  - UTF-8 BOM so Excel for Windows / Mac opens it without mojibake.
  - Expanded column set: `turn_started_at`, `turn_ended_at`, `source`,
    `model_short`, `effort`, `reasoning_tokens`, `project_name`,
    `project_path`, `user_prompt`, etc.
  - `?level=turn` for one row per conversation turn instead of one per
    API call.
  - Filename embeds range + level (e.g.
    `ccgauge-usage-claude-7d-turn-2026-05-12.csv`).
- **Cross-platform CLI hardening** (`bin/cli.mjs`):
  - `safeKill(pid, signal)` wraps `process.kill` with `ESRCH` tolerance.
  - `windowsHide: true` on the background `spawn` so Windows doesn't flash
    a console window.
  - `restart` inherits the previous session's `port / host / dir / log`
    when the user doesn't override them.
  - `0.0.0.0 / ::` is rewritten to `127.0.0.1` for the browser-open URL.
  - `getPort` candidates widened to 20 ports past the preferred.
  - `waitForUrl` per-attempt `AbortSignal.timeout(500)`.
  - `logs --follow` uses incremental `createReadStream` instead of
    reading the whole file every tick.
  - `state.json` carries a `version` field; readers ignore unknown shapes.
- **`AGENTS.md`** — working agreement for AI coding agents editing the
  repo. Architecture invariants, common pitfalls, "first file to open"
  table for typical symptoms.

### Changed

- **Default theme is `dark`** (previously `system`). Existing users keep
  their explicit choice.
- **Tools column visible by default** in the usage table; `STORAGE_KEY`
  bumped to `cols.v3` so existing visibility prefs are reset to the new
  defaults.
- **SegmentedPicker (range / granularity) active state** matches the
  source-switcher: brand-color fill instead of muted gray. Visible in
  both the page header (`今天 / 7天 / 30天 / 90天 / 全部`) and Section
  headers (`小时 / 天 / 周 / 月`).
- **Page header layout** on the usage page — model / project filters
  moved from the Trend section's right slot up to the page header
  alongside the range picker. They apply to all of KPI / trend / table,
  so they belong at the page level rather than scoped to one card.
- **Overview header** dropped the `costToday` and `activeSessions` KPI
  cards — they overlapped with the existing trend chart + activity
  stats.
- **5h block card** — `{pct}% elapsed` renamed to `Time elapsed {pct}%`
  / `时间进度 {pct}%`, with a disclaimer line clarifying it's wall-clock
  progress, not plan quota.
- **CLI option `-h, --host` → `-H, --host`.** `-h` now reliably resolves
  to `--help` for `ccgauge start` and friends. Long form `--host` is
  unchanged.
- **CLI auto-open semantics:** foreground opens the browser by default
  (`--no-open` to disable); background never auto-opens (`ccgauge open`
  to open the running one).
- **Build pipeline:** moved from `prepublishOnly` to `prepack` so
  `pnpm pack` also runs the build. Build now strips `@img/sharp-*`
  binaries + the bundled `typescript` package from `.next/standalone` so
  the published tarball is cross-platform (no `.node` / `.dylib` files
  ship). Tarball is ~6.8 MB compressed.
- **pnpm `node-linker = hoisted`** in `.npmrc`. Next.js standalone +
  pnpm's default isolated layout produced tarballs missing top-level
  `node_modules/next` (npm pack drops symlinks). Hoisted sidesteps it.
- **i18n / Chinese day-of-week labels** changed from one-char (`一 / 二`)
  to full `周一 / 周二 / …` for clarity.

### Fixed

- **Skill-injection turn splitting** — see Highlights.
- **5h block height** in the overview row now matches the activity card.
- **Nav scrollbar artefact** — the nav's `overflow-x-auto` rendered a
  thin gray scrollbar track on macOS even when content didn't overflow,
  which read as a divider against the navbar background. Replaced
  `scrollbar-thin` with a `nav-scroller` rule that hides the bar
  entirely.
- **Activity heatmap labels** — y-axis now shows every row (was every
  other), x-axis labels every 3 hours (was every 6).

### Notes for users upgrading from 0.4.x

- No data-file or storage migration is required. Cached entries are
  re-parsed automatically on first run (`parserVersion` bumped to
  `claude-v3-synthetic-flag` and `codex-v4-effort`).
- Two localStorage keys you may want to clear if you want pristine
  defaults: `ccgauge.usage.cols.*` (column visibility) and
  `ccgauge.usage.overview.hidden` (overview collapsed). Otherwise we
  honor whatever you had.
- If you scripted around the CSV column order, note that headers have
  been renamed (`cost` → `cost_usd`, `input` → `input_tokens`, etc.)
  and new columns were added. The metadata header (lines starting with
  `#`) now also lists `level=call|turn`.

## [0.4.0] — 2026-05-05

This release ships an **MCP (Model Context Protocol) server** so any
MCP-aware LLM client (Claude Desktop, Cursor, Cline, your own agent…)
can query your Claude Code + Codex CLI usage history through structured
tools. The on-disk index introduced in 0.3.0 is reused, so the MCP
server boots cold in ~110 ms and answers warm calls in O(1).

### Added

- **MCP server** (`ccgauge mcp`) — stdio JSON-RPC server bundled as
  `dist/mcp/server.mjs` (esbuild single-file ESM, ~800 KB). Wires into
  Claude Desktop / Cursor / Cline / generic MCP clients via standard
  `{ command, args }` config blocks. Documented in the README.
- **8 MCP tools**:
  - `usage_summary` — totals + per-source breakdown for any window
  - `usage_by_time` — bucketed time-series (hour / day / week / month)
  - `usage_by_model` — per-model cost share
  - `usage_by_project` — per-project cost share + last-activity
  - `usage_by_session` — session list with title / model / duration / cost
  - `daily_summary` — "what did I do on day X" with sessions grouped by project
  - `weekly_summary` — 7-day roll-up with per-day cost trend + top sessions / projects
  - `recent_activity` — N most recently active sessions
- **1 MCP resource** — `ccgauge://providers` (detected providers, dirs,
  record counts, indexer status).
- **`source: 'all'` (default)** on every analytical tool — the response
  carries combined totals **and** a `bySource: { claude, codex }`
  breakdown so the LLM can answer combined or provider-specific
  questions in a single call.
- **Reasoning-tokens breakdown** in the dashboard's token-total hover
  card and per-message session timeline. `output_tokens` still includes
  reasoning for OpenAI billing parity; the new `reasoning_tokens` field
  is display-only and never double-counted.
- **Per-named indexer instance** — `getIndexer(name)` lets the web
  dashboard and the MCP server have independent persisted caches
  (`index-v2.json` vs `index-mcp-v2.json`) so they never fight for the
  same on-disk state file.
- **Strict input validation** for MCP date arguments — invalid `range`,
  `from`, `to`, or `daily_summary.date` values are rejected at parse
  time (zod refinement) and at runtime (defensive throws), instead of
  silently falling back to all-time data.

### Fixed

- **`top_tools` now respects `source`** in `daily_summary` /
  `weekly_summary`. Previously it ignored the source arg and returned
  identical tool counts for `claude` / `codex` / `all`, mixing
  per-provider stats together.
- **`usage_by_time` now carries `reasoning_tokens` per bucket.** The
  field was hard-coded to 0, breaking any "reasoning over time"
  question even though the `usage_summary` total was correct.

### Changed

- Codex parser bumped to `codex-v3-reasoning-detail` (schema change to
  expose `reasoning_tokens`); persisted entries from earlier parsers
  are auto-invalidated on next startup.
- `lib/aggregator/index.ts` exports `bucketKey` so external callers
  (the MCP layer) can re-bucket records under the same key scheme.

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

[1.0.1]: https://github.com/chengzuopeng/ccgauge/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/chengzuopeng/ccgauge/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/chengzuopeng/ccgauge/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/chengzuopeng/ccgauge/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/chengzuopeng/ccgauge/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/chengzuopeng/ccgauge/compare/v0.1.1...v0.2.0
