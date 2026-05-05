// Bundled entry point for the MCP server. esbuild compiles this and all
// transitive deps (parsers, indexer, MCP SDK, zod, ...) into a single
// dist/mcp/server.mjs that the CLI spawns as a child Node process.
import { runStdioServer } from './server';

runStdioServer().catch((err) => {
  process.stderr.write(`[ccgauge-mcp] fatal: ${(err as Error).stack || err}\n`);
  process.exit(1);
});
