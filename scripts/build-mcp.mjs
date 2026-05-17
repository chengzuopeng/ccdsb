#!/usr/bin/env node
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

// Read version once from package.json — single source of truth. esbuild's
// `define` substitutes the literal at bundle time, so the published MCP
// server reports the same version as the npm tarball it ships in.
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

await build({
  entryPoints: [resolve(root, 'lib/mcp/entry.ts')],
  outfile: resolve(root, 'dist/mcp/server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Path aliases — match tsconfig "paths"
  alias: {
    '@': root,
    '@/lib': resolve(root, 'lib'),
  },
  // Bundle everything except Node built-ins. `fsevents` is the conventional
  // mac-only optional dep that can leak in via transitive watchers — we use
  // `fs.watch` directly so it's never actually needed.
  external: ['fsevents'],
  define: {
    __SERVER_VERSION__: JSON.stringify(pkg.version),
  },
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Minify trims ~40% off the 800 KB bundle (mostly identifiers + the MCP
  // SDK's docstrings). Sourcemap stays off so the tarball doesn't double in
  // size; debug stack traces lose file/line, which is acceptable for an
  // LLM-facing daemon.
  minify: true,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
});

console.log(`[build-mcp] dist/mcp/server.mjs written (v${pkg.version})`);
