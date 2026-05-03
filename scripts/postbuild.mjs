#!/usr/bin/env node
/**
 * Next.js with output: 'standalone' produces .next/standalone/server.js
 * but does NOT copy public/ or .next/static/ into the standalone tree.
 * This script copies them so the produced npm package can run self-contained.
 */
import { promises as fs, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  console.error(`[postbuild] standalone dir not found: ${standalone}`);
  console.error(`[postbuild] did 'next build' run successfully?`);
  process.exit(1);
}

await copyDir(join(root, '.next', 'static'), join(standalone, '.next', 'static'));

const publicDir = join(root, 'public');
if (existsSync(publicDir)) {
  await copyDir(publicDir, join(standalone, 'public'));
}

console.log('[postbuild] copied static assets into .next/standalone');

async function copyDir(src, dst) {
  if (!existsSync(src)) return;
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const sp = join(src, e.name);
    const dp = join(dst, e.name);
    if (e.isDirectory()) {
      await copyDir(sp, dp);
    } else if (e.isFile()) {
      await fs.copyFile(sp, dp);
    }
  }
}
