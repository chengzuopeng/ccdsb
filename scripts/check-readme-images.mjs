#!/usr/bin/env node
/**
 * Guard against broken README image links on npmjs.com.
 *
 * The npm registry renders README.md but does NOT resolve relative
 * `<img src>` paths — only absolute URLs work. We use
 * `https://raw.githubusercontent.com/chengzuopeng/ccgauge/main/...`
 * URLs for that reason (see AGENTS.md "Don't break end-users").
 *
 * The cost of this scheme: if anyone renames a screenshot, moves
 * docs/screenshots/, or renames the repo / default branch, the URL
 * keeps pointing at a 404 and the npmjs.com page silently breaks.
 *
 * This script extracts every raw.githubusercontent.com URL from the
 * READMEs, maps each back to a local repo path, and fails if the
 * file isn't on disk. Runs in `pnpm test` so a release that would
 * ship a broken README image gets caught pre-publish.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

// Format we expect:
//   https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>
const RAW_URL = /https:\/\/raw\.githubusercontent\.com\/([^/\s)]+)\/([^/\s)]+)\/([^/\s)]+)\/([^\s)]+)/g;

const EXPECTED_OWNER = 'chengzuopeng';
const EXPECTED_REPO = 'ccgauge';
const EXPECTED_BRANCH = 'main';

const READMES = [
  resolve(repoRoot, 'README.md'),
  resolve(repoRoot, 'README.zh-CN.md'),
];

let failed = false;
for (const readme of READMES) {
  if (!existsSync(readme)) {
    console.error(`✘ readme not found: ${readme}`);
    failed = true;
    continue;
  }
  const src = readFileSync(readme, 'utf8');
  const matches = [...src.matchAll(RAW_URL)];
  if (matches.length === 0) {
    console.log(`· ${readme.replace(repoRoot + '/', '')}: no raw.githubusercontent.com URLs`);
    continue;
  }
  for (const m of matches) {
    const [url, owner, repo, branch, relPath] = m;
    if (owner !== EXPECTED_OWNER || repo !== EXPECTED_REPO) {
      console.error(
        `✘ ${readme.replace(repoRoot + '/', '')}: unexpected owner/repo in URL\n` +
          `   url:      ${url}\n` +
          `   expected: ${EXPECTED_OWNER}/${EXPECTED_REPO}`,
      );
      failed = true;
      continue;
    }
    if (branch !== EXPECTED_BRANCH) {
      console.error(
        `✘ ${readme.replace(repoRoot + '/', '')}: unexpected branch in URL\n` +
          `   url:      ${url}\n` +
          `   expected branch: ${EXPECTED_BRANCH}`,
      );
      failed = true;
      continue;
    }
    // Map the raw URL's <path> back to a local file under the repo root.
    const localPath = resolve(repoRoot, relPath);
    if (!localPath.startsWith(repoRoot)) {
      console.error(`✘ ${readme}: URL path escapes repo root: ${relPath}`);
      failed = true;
      continue;
    }
    if (!existsSync(localPath)) {
      console.error(
        `✘ ${readme.replace(repoRoot + '/', '')}: image target missing on disk\n` +
          `   url:        ${url}\n` +
          `   resolved:   ${localPath.replace(repoRoot + '/', '')}\n` +
          `   → Either restore the file, or update the URL to point at an existing one.`,
      );
      failed = true;
      continue;
    }
    console.log(
      `✓ ${readme.replace(repoRoot + '/', '')}: ${relPath}`,
    );
  }
}

if (failed) {
  console.error('\nreadme-images check FAILED.');
  process.exit(1);
}
console.log('\nAll README image URLs resolve to files in the repo.');
