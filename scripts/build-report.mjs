#!/usr/bin/env node
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

await build({
  entryPoints: [resolve(root, 'lib/cli-report/index.ts')],
  outfile: resolve(root, 'dist/report/index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  alias: {
    '@': root,
    '@/lib': resolve(root, 'lib'),
  },
  external: [],
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
});

console.log('[build-report] dist/report/index.mjs written');
