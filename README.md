<div align="center">

# ccgauge

**Local, privacy-first usage dashboard for AI coding CLIs.** Track tokens, cost, and prompt-caching savings across **Claude Code** and **OpenAI Codex CLI** in a single browser tab — without sending a byte to anyone.

[![npm version](https://img.shields.io/npm/v/ccgauge?color=4F46E5&style=flat-square)](https://www.npmjs.com/package/ccgauge)
[![license](https://img.shields.io/npm/l/ccgauge?color=4F46E5&style=flat-square)](./LICENSE)
[![node](https://img.shields.io/node/v/ccgauge?color=4F46E5&style=flat-square)](#)

[English](./README.md) · [简体中文](./README.zh-CN.md)

</div>

```bash
npx ccgauge
```

One command. ccgauge reads the JSONL session files Claude Code and Codex CLI already write to your disk, computes per-day / per-project / per-model token usage and **dollar-equivalent cost**, then opens a unified web dashboard in your browser. Switch between data sources with one click. **No login, no telemetry, no network calls.**

![Overview — English / Dark](./docs/screenshots/overview-en-dark.png)

---

## Why ccgauge

If you pay per token on the API, or sit on a Claude Pro / Max / Team / Codex Plus subscription, you've probably wondered:

- *"How much would Claude Code have cost me on the API this month?"*
- *"Is prompt caching actually saving me money — and how much?"*
- *"Which project / session / model is eating the most tokens?"*
- *"How close am I to the 5-hour rate-limit window resetting?"*

The terminal-based [ccusage](https://github.com/ryoppippi/ccusage) is great for printing tables. ccgauge gives you **the same data plus charts, drill-down, a live 5-hour block countdown — and it's the unified dashboard for both Claude Code and OpenAI Codex CLI side by side**.

Everything runs locally as a Next.js app. Your conversation transcripts never leave the machine.

## Highlights

### Cross-provider analytics
- One dashboard for both **Claude Code** and **OpenAI Codex CLI**
- Toggle data source from the nav bar; URL persists via `?source=`, last choice cached in cookie
- Built-in **provider adapter layer** (`lib/providers/`) — adding a third CLI (Gemini CLI, Cursor, Aider, …) is one new file plus a single registry line

### At-a-glance KPIs
- **Tokens today**, cost today, this month, cache hit rate, top model, active sessions
- Day-over-day delta on every card (`vs yesterday`)
- **Live 5-hour block** — countdown, progress bar, burn-rate per minute, projected total cost

### Drill-down everywhere
- **Sessions** — per-conversation list with model / tokens / cost / duration, plus a message-level timeline
- **Projects** — per-`cwd` aggregation cards with sparkline and spend share
- **Models** — side-by-side comparison: cost share, tokens share, cache hit, USD pricing
- **Usage** — turn-grouped table with expandable tool-call breakdown, CSV export

### Cost transparency
- **Cache savings** is its own KPI — quantifies how much Anthropic prompt caching saved you vs. paying full input price
- Codex cost shown as the **OpenAI API equivalent** so subscription users can compare value against pay-as-you-go
- Built-in pricing tables: 12 Claude models + the gpt-5 family + o-series; unknown models fall back to family-latest

### Polished local UI
- **Light / Dark / System** themes, no flash of incorrect theme
- **English / 中文** (cookie + localStorage)
- Filters: time range (today / 7d / 30d / 90d / all), granularity (hour / day / week / month), model and project multi-select

### Privacy by design
- 100 % local: read-only access to existing JSONL files, zero outbound network calls
- Open source, MIT-licensed
- Background mode for a quiet always-on service, with `start / stop / restart / status / open / logs` lifecycle commands

## Quick start

Zero-install one-shot:

```bash
npx ccgauge
```

Or install globally:

```bash
npm  i -g ccgauge && ccgauge          # npm
pnpm i -g ccgauge && ccgauge          # pnpm
yarn global add ccgauge && ccgauge    # yarn
```

The dashboard opens at [http://localhost:3737](http://localhost:3737). If 3737 is taken, ccgauge falls back to the next free port automatically. Press `Ctrl+C` to stop.

**Requirements:** Node.js 20+ (Node 22 recommended for `pnpm test`). Works on macOS, Linux, and Windows.

## CLI reference

`ccgauge` is shorthand for `ccgauge start`, so flags work after either command.

### Foreground (default)

```bash
ccgauge
ccgauge --port 4000 --no-open
ccgauge start --host 0.0.0.0 --port 4000
```

### Background service

```bash
ccgauge start --background

ccgauge status
ccgauge open
ccgauge logs           # last 80 lines
ccgauge logs --follow  # tail in real time
ccgauge restart --port 4000
ccgauge stop
```

Background mode persists state under `~/.ccgauge/`:
- `state.json` — PID, URL, start time, log file path
- `ccgauge.log` — server output (read by `ccgauge logs`)
- Override with `CCGAUGE_STATE_DIR=/path/to/dir` for isolated profiles or tests

### Commands

| Command | Purpose |
| --- | --- |
| `ccgauge`, `ccgauge start` | Start in foreground. `Ctrl+C` to stop. |
| `ccgauge start --background` | Start a detached background service. |
| `ccgauge stop [--force]` | Stop the background service. |
| `ccgauge restart [options]` | Stop and re-start with new options. |
| `ccgauge status [--json]` | Inspect the background service. |
| `ccgauge open` | Open the running dashboard in your browser. |
| `ccgauge logs [-f] [-n <lines>]` | Print background logs. |

### Startup options

| Option | Applies to | Purpose |
| --- | --- | --- |
| `-p, --port <port>` | start, restart, root | Preferred port. Default: `3737`. |
| `-H, --host <host>` | start, restart, root | Bind host. Default: `127.0.0.1`. |
| `--no-open` | start, root | Skip auto-open in foreground mode. (Background mode never auto-opens; use `ccgauge open` instead.) |
| `--dir <path>` | start, restart, root | Add `<path>/projects` as a Claude data source. |
| `-q, --quiet` | start, restart, root | Silence Next.js output. |
| `-b, --background` | start, root | Run as a detached background service. |
| `--strict-port` | start, restart, root | Fail if the preferred port is busy. |
| `--log <path>` | start --background, restart | Background log file path. |

## Configuration

ccgauge auto-detects the standard locations:

| Provider | Default sources |
| --- | --- |
| Claude Code | `~/.claude/projects`, `~/.config/claude/projects` |
| OpenAI Codex CLI | `~/.codex/sessions`, `~/.codex/archived_sessions` |

Override or extend via environment variables:

| Variable | Effect |
| --- | --- |
| `CCGAUGE_CONFIG_DIR` | Add `<dir>/projects` as a Claude data source |
| `CLAUDE_CONFIG_DIR` | Same as above (Claude Code 1.0.30+ compatible) |
| `CCGAUGE_CODEX_DIR` | Add an extra Codex sessions directory |
| `CODEX_HOME` | Add `<dir>/sessions` and `<dir>/archived_sessions` |
| `CCGAUGE_STATE_DIR` | Override background service state/log directory |

## Architecture

```
~/.claude/projects/**/*.jsonl  ──┐
                                 ├─►  ProviderAdapter registry
~/.codex/sessions/**/*.jsonl  ───┘    │
                                      ▼
                              scanAll() ─► dedup ─► aggregate by
                                                    time / model / project / session / 5h block
                                                ▼
                                  Next.js RSC pages + client charts
```

1. **CLI** (`bin/cli.mjs`) normalizes flags, validates the standalone build, picks a port via [`get-port`](https://github.com/sindresorhus/get-port).
2. **Foreground** uses `fork()` and binds to your terminal; **background** uses detached `spawn()` with state in `~/.ccgauge/`.
3. **Provider adapters** (`lib/providers/<name>/index.ts`) own data dirs, JSONL parser, pricing table, and model-name formatter. The registry-driven design means adding a third provider is one file plus one registry line.
4. **Claude parser** reads each line as a typed event, extracts `usage` from assistant messages.
5. **Codex parser** uses a turn state machine, emits one record per `event_msg.token_count` from `last_token_usage` (avoids cumulative double-counting), folds `cached_input_tokens` into cache-read and `reasoning_output_tokens` into output.
6. **Pricing** ships built-in snapshots — Anthropic published rates for Claude (12 models) and OpenAI public rates for Codex (gpt-5 family + o-series). Codex cost is labelled "API equivalent" because subscription plans (Plus, Pro) bill differently.
7. **i18n + theme** is cookie-driven SSR with a no-flash inline script in `<head>` and `localStorage` mirror.

## Adding a provider

```
lib/providers/<name>/
  index.ts             ProviderAdapter implementation
  parse-<name>.ts      JSONL → AssistantRecord[]
  pricing.ts           model → Pricing
  shorten-model.ts     pretty model names
```

Register one line in `lib/providers/index.ts`, add the id to the `ProviderId` union, and you're done. `scan.ts`, the aggregator, the pricing module, and every page need no changes.

## Develop

This repo is a working Next.js project — run the dashboard against your live data while iterating.

```bash
git clone https://github.com/chengzuopeng/ccgauge.git
cd ccgauge
pnpm install
pnpm dev               # http://localhost:3737
```

Scripts:

```bash
pnpm typecheck         # tsc --noEmit
pnpm lint              # eslint .
pnpm test              # codex parser smoke test (Node 22+)
pnpm build             # next build + copy static into .next/standalone
pnpm start             # run bin/cli.mjs against the standalone build
pnpm screenshots       # regenerate docs/screenshots/*.png
pnpm clean             # rm -rf .next node_modules
```

Publish:

```bash
pnpm pack              # preview the tarball
pnpm publish --access public  # runs `pnpm build` first via prepublishOnly
```

## Troubleshooting

| Symptom | Try |
| --- | --- |
| Port keeps drifting | `ccgauge --strict-port --port 3737` |
| Stale background service | `ccgauge status`, then `ccgauge stop --force` |
| Background didn't start | `ccgauge logs` reads `~/.ccgauge/ccgauge.log` |
| Need an isolated profile | `CCGAUGE_STATE_DIR=/tmp/ccgauge-test ccgauge start -b` |
| No data shown for Codex | Ensure `~/.codex/sessions` exists; check the **Settings** page for detected paths |
| Want to bypass auto-open | `ccgauge --no-open` |

## FAQ

**Does ccgauge upload my conversations or transcripts?**
No. ccgauge runs entirely on your machine. It only reads the JSONL files Claude Code and Codex CLI already store locally. There are zero outbound network calls.

**How is this different from ccusage?**
[ccusage](https://github.com/ryoppippi/ccusage) is a terminal CLI that prints usage tables. ccgauge is a polished web dashboard with charts, per-session drill-down, a 5-hour rate-limit countdown, project / model breakdowns, and **also covers OpenAI Codex CLI** out of the box.

**Does it work for Claude Pro / Max / Team / Codex Plus subscribers?**
Yes. The dashboard always reports the **API-equivalent dollar value** of your usage so you can see "how much would this have cost on PAYG". Subscription plans bill differently; ccgauge is not your invoice.

**Which models / providers are supported?**
- **Claude Code**: all `claude-*` models (Opus / Sonnet / Haiku, 3.x and 4.x)
- **OpenAI Codex CLI**: gpt-5 family (gpt-5, gpt-5-mini, gpt-5-nano, gpt-5.4, gpt-5.5, gpt-5.5-mini, gpt-5.5-nano), gpt-4.1 / gpt-4.1-mini, plus o-series (o3, o4-mini)
- Unknown models fall back to family-latest pricing automatically

**Can I add my own provider?**
Yes — see [Adding a provider](#adding-a-provider). The provider adapter layer is the explicit extension point.

**Does it require Anthropic or OpenAI credentials?**
No. ccgauge never calls upstream APIs. It reads the local JSONL transcripts those CLIs already write.

## Keywords

`claude code dashboard` · `claude code usage` · `claude code cost tracker` · `claude code analytics` ·
`codex cli usage` · `codex cli dashboard` · `openai codex usage` · `openai codex tracker` ·
`ai cli token tracker` · `ai coding assistant cost` · `claude pro plan usage monitor` ·
`claude max plan tracker` · `codex plus plan usage` · `prompt caching savings dashboard` ·
`5-hour block tracker` · `rate limit window monitor` · `ccusage alternative` · `ccusage web ui` ·
`token usage analytics` · `agentic coding stats` · `local ai usage monitor` · `self-hosted ai dashboard`

## License

MIT — see [LICENSE](./LICENSE).
