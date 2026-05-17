#!/usr/bin/env node
/**
 * Guard against the "I edited parser code but forgot to bump
 * `parserVersion`" failure mode.
 *
 * The indexer keys its on-disk cache (`~/.ccgauge/cache/index-v2.json`)
 * by `(filePath, parserVersion)`. If the parser logic changes but the
 * version string stays the same, the indexer happily re-uses stale
 * entries computed by the OLD parser — a silent correctness failure
 * that the user only spots when "the numbers look weird".
 *
 * This script reads a baseline from `scripts/parser-versions.json` and
 * asserts every provider's current `parserVersion` matches. To intentionally
 * bump a parser version:
 *
 *   1. Update `parserVersion` in `lib/providers/<name>/index.ts`.
 *   2. Update the matching entry in `scripts/parser-versions.json`.
 *   3. Run `pnpm test` to confirm.
 *
 * Anyone who edits parser code without doing step 2 sees this script
 * fail in `pnpm test`, which (per AGENTS.md release checklist) runs in
 * the release flow.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

/** Load the baseline declared in scripts/parser-versions.json. */
function loadBaseline() {
  const path = resolve(here, 'parser-versions.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Cheap regex-based parser version lookup — avoids having to import the
 *  TS module (which would need a transpile step). The file format is
 *  trusted (the same file the indexer reads at runtime). */
function readParserVersionFromAdapter(adapterFile) {
  const src = readFileSync(adapterFile, 'utf8');
  const m = src.match(/parserVersion:\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error(`no parserVersion literal found in ${adapterFile}`);
  return m[1];
}

const baseline = loadBaseline();
const adapters = [
  { id: 'claude', file: resolve(repoRoot, 'lib/providers/claude/index.ts') },
  { id: 'codex', file: resolve(repoRoot, 'lib/providers/codex/index.ts') },
];

let failed = false;
for (const { id, file } of adapters) {
  const actual = readParserVersionFromAdapter(file);
  const expected = baseline[id];
  if (!expected) {
    console.error(`✘ ${id}: no baseline entry in scripts/parser-versions.json`);
    failed = true;
    continue;
  }
  if (actual !== expected) {
    console.error(
      `✘ ${id}: parserVersion drift\n` +
        `   adapter:  ${actual}\n` +
        `   baseline: ${expected}\n` +
        `   → If you intentionally bumped the parser, update scripts/parser-versions.json.\n` +
        `   → If you didn't, restore the previous parserVersion in lib/providers/${id}/index.ts.`,
    );
    failed = true;
  } else {
    console.log(`✓ ${id}: parserVersion=${actual}`);
  }
}

if (failed) {
  console.error('\nparser-versions check FAILED.');
  process.exit(1);
}
console.log('\nAll parser versions match the baseline.');
