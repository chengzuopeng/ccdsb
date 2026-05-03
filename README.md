# ccdsb

> **C**laude **C**ode **D**a**s**h**b**oard — a zero-config local web UI for your Claude Code token usage and cost.

```bash
npx ccdsb
```

That's it. ccdsb scans `~/.claude/projects/` (and `~/.config/claude/projects/`), reads the JSONL files, computes token usage and USD cost, and opens a dashboard in your browser. Data never leaves your machine.

## Features

- **Overview** — KPI cards: tokens today, cost today, this month, cache hit rate, top model, sessions today
- **5h block** — live countdown + progress bar for the current Claude Code rolling 5-hour window
- **Usage trend** — stacked bar chart broken down by `input` / `output` / `cache_read` / `cache_creation`
- **Sessions** — per-conversation breakdown with message-level timeline
- **Projects** — per-`cwd` aggregation
- **Models** — side-by-side comparison with cost/token share + cache hit per model
- **Cache savings** — a separate KPI showing how much cache reads have saved you
- **i18n** — English / 中文, persisted to localStorage + cookie
- **Themes** — Light / Dark / System (no-flash on initial paint)
- **Filters** — time range, granularity (hour/day/week/month), model multi-select, project multi-select
- **Export** — CSV download of the request log
- **100% local** — read-only access to JSONL files, no telemetry, no network calls

## Install / Run

```bash
# zero-install one-shot (recommended)
npx ccdsb

# global install
npm  i -g ccdsb     && ccdsb
pnpm i -g ccdsb     && ccdsb
yarn global add ccdsb && ccdsb

# pnpm dlx
pnpm dlx ccdsb
```

### Options

```
ccdsb [options]

  -p, --port <port>     preferred port (default: 3737)
  -h, --host <host>     bind host (default: 127.0.0.1)
      --no-open         do not auto-open the browser
      --dir <path>      override Claude config dir (will append /projects)
  -q, --quiet           silence Next.js output
  -V, --version         output version
      --help            show help
```

### Environment variables

| Variable             | Effect                                                              |
| -------------------- | ------------------------------------------------------------------- |
| `CCDSB_CONFIG_DIR`   | Use `<dir>/projects` as a data source (in addition to defaults)     |
| `CLAUDE_CONFIG_DIR`  | Same as above (compatible with Claude Code 1.0.30+)                 |

## Develop

This repo is also a working Next.js project — you can run the dashboard against your live data while iterating on the code.

```bash
git clone <repo>
cd ccdsb
pnpm install
pnpm dev               # http://localhost:3737
```

Other handy scripts:

```bash
pnpm typecheck         # tsc --noEmit
pnpm lint              # next lint
pnpm build             # next build + copy static into .next/standalone
pnpm start             # run bin/cli.mjs against the standalone build
pnpm clean             # rm -rf .next node_modules tsconfig.tsbuildinfo
```

To produce the npm-publishable artifact:

```bash
pnpm build
node bin/cli.mjs       # exact same entrypoint as `npx ccdsb`
```

To preview what would be published:

```bash
pnpm pack --dry-run
```

## Publish

```bash
# bump version in package.json, then:
pnpm publish --access public
```

`prepublishOnly` will run `pnpm build` first, so the `.next/standalone` artifact is always fresh.

## How it works

1. CLI (`bin/cli.mjs`) picks an available port via `get-port`, then `fork()`s the Next.js standalone server (`.next/standalone/server.js`).
2. Once the server responds, it `open()`s the browser to that URL.
3. The Next.js server-side code in `lib/data-loader/scan.ts` reads `~/.claude/projects/**/*.jsonl`, parses every `assistant` message, dedups via `(message.id, requestId)`, and aggregates.
4. Pricing is from a built-in snapshot of Anthropic's published rates (12 models). Unknown models fall back to the same family's latest rate.

See [PLAN.md](./PLAN.md) for the full design rationale.

## License

MIT
