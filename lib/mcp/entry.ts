// Bundled entry point for the MCP server. esbuild compiles this and all
// transitive deps (parsers, indexer, MCP SDK, zod, ...) into a single
// dist/mcp/server.mjs.
//
// Two invocation modes both work:
//   (a) `node dist/mcp/server.mjs` — process entry path. The auto-run
//       block at the bottom kicks `runStdioServer` and hooks the fatal
//       error path.
//   (b) `await import(bundle)` from `bin/cli.mjs` — the CLI calls our
//       exports directly (in-process), skipping the second `node`
//       launch + signal-forwarding shim. `process.argv[1]` then points
//       at `cli.mjs`, not this bundle, so the auto-run block is a no-op.
import { fileURLToPath } from 'node:url';
import { runStdioServer } from './server';
import { printCheck } from './check';

export { runStdioServer, printCheck };

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] === thisFile) {
  runStdioServer().catch((err) => {
    process.stderr.write(`[ccgauge-mcp] fatal: ${(err as Error).stack || err}\n`);
    process.exit(1);
  });
}
