# AGENTS.md

Working agreement for AI coding agents (Claude Code, Codex CLI, Cursor agents,
etc.) editing this repo. Humans should skim it too — it captures the non-obvious
parts of the codebase that aren't in the README.

## What this project is

`ccgauge` is a **local web dashboard + CLI + MCP server** for inspecting
**Claude Code** and **OpenAI Codex CLI** token usage and cost. Everything runs
on the user's machine; there are zero outbound network calls at runtime.

Three user-facing surfaces share one data layer:

| Surface | Entry | Talks to |
| --- | --- | --- |
| Web dashboard | `app/` (Next.js 15 RSC) | the indexer singleton |
| CLI (`ccgauge`) | `bin/cli.mjs` | the indexer via a bundled `dist/report/index.mjs` |
| MCP server (`ccgauge mcp`) | `lib/mcp/entry.ts` → `dist/mcp/server.mjs` | the indexer via a separate `'mcp'`-named instance |

Published to npm as `ccgauge`. End-users typically run `npx ccgauge`.

## Repo layout

```
app/                       Next.js routes (RSC pages + /api routes)
  api/                     Server-side JSON endpoints (scan, usage, sessions, …)
  page.tsx                 Overview
  usage/, sessions/, …     Drill-down pages

bin/cli.mjs                Single-file CLI (commander). Imports the bundled
                           dist/report/index.mjs and dist/mcp/server.mjs lazily
                           when those subcommands run.

components/                React. All client UI atoms (KpiCard, Section,
                           usage-table, hover-card, activity-stats, …).

lib/
  providers/               Per-CLI adapters (claude, codex). Add a new provider
                           by dropping a folder + one line in lib/providers/index.ts.
  data-loader/             scan.ts (entry), indexer.ts (singleton + watchers +
                           persist), parse-jsonl.ts (claude parser).
  aggregator/              Pure aggregations: totals, time-buckets, by-model,
                           by-project, by-session, activity heatmap.
  pricing/                 cost-from-usage.ts (math) + per-provider rate tables.
  serialize.ts             Shape AssistantRecord[] → UsageTableRow[] /
                           UsageTurnRow[]; turn grouping lives here too.
  turns.ts                 Parent-chain walking that decides which assistant
                           records collapse into the same "turn".
  cli-report/              The pretty terminal report. Bundled into dist/report.
  mcp/                     MCP server (stdio JSON-RPC). Bundled into dist/mcp.
  i18n/, theme/            Cookie-driven SSR + localStorage mirror + no-flash.

scripts/                   Build & test helpers (esbuild bundlers, postbuild,
                           parser fixtures).

dist/                      esbuild output. Not source-controlled — generated
                           by `pnpm build`. Listed in package.json#files so it
                           ships in the npm tarball.
```

## Commands you'll actually run

```bash
pnpm dev            # Next dev on :3738, hot-reload
pnpm typecheck      # tsc --noEmit — run before any commit
pnpm lint           # eslint flat config — run before any commit
pnpm test           # codex parser smoke test (node --experimental-strip-types)
pnpm build:report   # rebuild just dist/report (lib/cli-report/index.ts → bundle)
pnpm build:mcp      # rebuild just dist/mcp
pnpm build          # full: next build + mcp + report + postbuild

# After source changes, exercise the CLI without reinstalling:
node bin/cli.mjs report --no-color -r 7d
node bin/cli.mjs report --json | jq .totals
```

`pnpm dev` starts on port **3738** (not 3737). Standalone `npx ccgauge` starts
on 3737 by default.

## Architecture invariants (the non-obvious stuff)

1. **The indexer is a module-level singleton with file watchers.**
   `lib/data-loader/indexer.ts` exports `export const indexer = getIndexer()`
   which is a side effect at import time. Anything that imports this module —
   even just to call `getCachedScan()` — spins up a long-lived indexer that
   watches `~/.claude/projects` / `~/.codex/sessions` and writes
   `~/.ccgauge/cache/index-v2.json`. Implications:
   - **In `pnpm dev`, the singleton survives HMR.** If you change parser code,
     the module is reloaded but the existing indexer's in-memory `files` map
     still holds records parsed by the **old** code. Bump the provider's
     `parserVersion` in `lib/providers/<name>/index.ts` so the indexer detects
     a mismatch and re-parses. Then **restart the dev server** — HMR alone
     isn't enough.
   - **Stale MCP processes contend with the dashboard for the same on-disk
     cache.** If a user has zombie `ccgauge mcp` processes from old Claude
     Code sessions, they keep writing v1-shape entries back into
     `index-v2.json` and silently undo your fix. When debugging "the change
     didn't take effect", `ps -ef | grep ccgauge` and kill stragglers first.
   - The MCP server uses a **separate** named cache (`index-mcp-v2.json`) for
     its own indexer, but the module-level default indexer also fires when
     the MCP entry is imported — that's where the contention comes from.

2. **Turn grouping walks the JSONL parent chain.**
   `lib/turns.ts` resolves each assistant record to its turn by walking
   `parentUuid` until it hits a user record with non-empty `textPreview` AND
   `isSynthetic !== true`. Synthetic injections (skill metadata,
   `<system-reminder>` blocks) are flagged by `parse-jsonl.ts#isSyntheticUserText`
   and skipped as turn boundaries — but their text is preserved on the
   `UserRecord` so child rows can still surface it as a per-call prompt
   (the `directPrompt` field on `UsageTableRow`).

3. **Records are deduped after parsing.**
   The same `(messageId, requestId)` can appear in multiple JSONL files
   (sub-agent forks, worktree mirroring). `lib/dedup.ts#dedupAssistantRecords`
   keeps the earliest-timestamp one. **The `parentMap` passed to
   `buildTurnIndex` is the pre-dedup map** so chain walking still works when
   an intermediate hop got deduped out.

4. **Codex token math has a known gotcha.**
   The JSONL emits cumulative `total_token_usage` per `token_count` event.
   We compute forward-only deltas (`Math.max(0, cur - prev)` per field) and
   skip duplicate refresh events. See `lib/providers/codex/parse-codex-jsonl.ts`
   — bumping `parserVersion` if you touch this is mandatory or users will
   see double-counted totals against stale cache.

5. **Pricing is a snapshot, not a lookup.**
   `lib/providers/<name>/pricing.ts` ships hard-coded per-million-token rates.
   Unknown models fall back to family-latest (e.g. `gpt-5.5-foo` → `gpt-5.5`
   rate). Update both providers in tandem if Anthropic / OpenAI revise prices.

6. **Theme + locale never flash.**
   `components/no-flash-script.tsx` is an inline `<head>` script that reads
   localStorage and applies the theme/locale class on `<html>` before any
   paint. Default theme is **dark**; default locale is **en**. Returning
   users keep whatever they chose. If you add another preference that needs
   no-flash treatment, extend this script and the CSS variable system in
   `app/globals.css` — don't introduce a second inline script.

7. **CSV export is streamed and Excel-safe.**
   `app/api/export/usage/route.ts` writes a UTF-8 BOM, escapes formula-injection
   prefixes (`=+-@\t\r`), and supports `?level=call|turn`. Don't switch to
   buffered string concat; large exports rely on the streaming path.

8. **`KpiCard` no longer has hover animation.**
   Removed in May 2026 because the lift-on-hover felt like jitter on the KPI
   row. If you re-add interactivity here, prefer a focus-ring on
   click/keyboard rather than a passive hover transform.

## Conventions

- **TypeScript everywhere.** `.ts` / `.tsx`. The CLI entry is `.mjs` so it can
  ship as-is in the npm tarball without compilation; everything it imports is
  pre-bundled via esbuild into `dist/`.
- **Server components by default.** Pages and most components are RSC. Add
  `'use client'` only when you need state, effects, or event handlers.
- **`@/` is repo-root.** Configured in `tsconfig.json` and aliased identically
  in the esbuild bundlers (`scripts/build-*.mjs`). Don't introduce other path
  aliases.
- **i18n via `tFn(locale, key, vars)`** or the `useT()` client hook.
  Translation dictionaries live in `lib/i18n/dict.ts` (en + zh side-by-side).
  Any user-facing string belongs there; don't inline literals in components.
- **Styling: Tailwind + a small set of `@layer components` classes** declared
  in `app/globals.css` (`card`, `card-pad`, `label`, `num-hero`, `pill`,
  `btn`, …). Reach for those before raw utility soup. Colors come from CSS
  variables exposed via `tailwind.config.ts` (`text-text-primary`, `bg-brand`,
  …) — don't hard-code hex.
- **Identity per repo.** Per the user's `~/.claude/CLAUDE.md`, this is a
  GitHub remote so use `chengzuopeng` / `mrchengzp@qq.com` for any commits.
  Never include `Co-Authored-By: Claude/Codex/...` trailers.

## When you touch parsing or aggregation

A short pre-flight checklist:

1. Update the parser code.
2. Bump the relevant `parserVersion` in `lib/providers/<name>/index.ts` so
   cached entries from old code are invalidated.
3. Run `pnpm typecheck && pnpm lint && pnpm test`.
4. Restart `pnpm dev` (not just refresh) so the indexer singleton is rebuilt.
5. Spot-check the dashboard against a manual sum from the raw JSONL — the
   easiest cross-check is `node bin/cli.mjs report --json -r all | jq .totals`
   vs a quick Python script summing `usage.*` fields directly.

## Things that are intentionally NOT supported

- Sending data anywhere outside the user's machine. The dashboard binds to
  `127.0.0.1` by default. `--host 0.0.0.0` is allowed but discouraged.
- Editing or writing back to Claude Code / Codex JSONL files. We read only.
- Real-time subscription to Anthropic/OpenAI billing APIs. The numbers are
  derived from local JSONL × ccgauge's built-in price tables only.

## Where to look first when something feels wrong

| Symptom | First file to open |
| --- | --- |
| "Cost looks 2× what it should be" | `lib/providers/codex/parse-codex-jsonl.ts` (cumulative vs delta) |
| "Conversations split into weird rows" | `lib/turns.ts` + `lib/data-loader/parse-jsonl.ts#isSyntheticUserText` |
| "Dashboard shows stale data after my change" | Indexer singleton + parserVersion bump (see invariant #1) |
| "CSV opens with mojibake in Excel" | `app/api/export/usage/route.ts` (BOM, encoding) |
| "Theme flashes on load" | `components/no-flash-script.tsx` |
| "Pricing wrong for new model" | `lib/providers/<name>/pricing.ts` + the fallback table |
| "MCP tool returns nothing" | `lib/mcp/tools/` and check `~/.ccgauge/cache/index-mcp-v2.json` exists |

## Don't break end-users

`prepack` runs `pnpm build`, which produces a self-contained tarball
(~7 MB compressed). Two cross-platform pitfalls that have bitten us before:

- The Next.js standalone tree pulls in `sharp` + `@img/sharp-libvips-<platform>`
  even though we set `images.unoptimized: true`. `scripts/postbuild.mjs`
  strips them — don't undo that, the platform-specific `.node` / `.dylib`
  files would break Linux / Windows installs.
- The standalone build also drags in the `typescript` package. Same script
  strips it. The runtime never needs it.

If you change the build pipeline, verify `tar -tzf <pkg>.tgz | grep -E '\.(node|dylib|so|dll)$'` returns empty before publishing.
