#!/usr/bin/env node
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

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
  // Bundle everything except Node built-ins (no need to exclude — bundled npm deps work fine for a single-file CLI)
  external: [],
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Mark deps small enough to inline; sourcemap off to keep tarball lean
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
});

console.log('[build-mcp] dist/mcp/server.mjs written');
