import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerUsageTools } from './tools/usage';
import { registerActivityTools } from './tools/activity';
import { registerProvidersResource } from './resources/providers';
import { getMcpIndexerReady } from './context';

const SERVER_NAME = 'ccgauge';
// Injected at bundle time by `scripts/build-mcp.mjs` via esbuild's `define`,
// sourced from package.json#version so the server identifies itself
// consistently with the npm release that ships it. Falls back to the
// literal "dev" only when imported outside the bundle (e.g. dev / tests).
declare const __SERVER_VERSION__: string;
const SERVER_VERSION =
  typeof __SERVER_VERSION__ !== 'undefined' ? __SERVER_VERSION__ : 'dev';

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  registerUsageTools(server);
  registerActivityTools(server);
  registerProvidersResource(server);

  return server;
}

/** Boot the MCP server on stdio. Used by `ccgauge mcp`. */
export async function runStdioServer(): Promise<void> {
  // Anything we write to stdout becomes JSON-RPC noise — make sure
  // logs go to stderr.
  const log = (...args: unknown[]) => {
    process.stderr.write(`[ccgauge-mcp] ${args.map(String).join(' ')}\n`);
  };

  // Eagerly init the indexer so the first tool call doesn't pay the
  // cold-start cost. We don't await — let it warm up in the background.
  getMcpIndexerReady()
    .then((idx) => {
      const s = idx.getStatus();
      log(
        `indexer ready: files=${s.filesIndexed} records=${s.recordsIndexed} loadedFromDisk=${s.loadedFromDisk}`,
      );
    })
    .catch((err) => log('indexer init failed:', (err as Error).message));

  const server = createServer();
  const transport = new StdioServerTransport();

  // Graceful shutdown on stdin close (parent process exits).
  const shutdown = () => {
    log('shutting down');
    transport.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await server.connect(transport);
  log(`v${SERVER_VERSION} listening on stdio`);
}
