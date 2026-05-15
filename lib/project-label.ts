// Server-only. Resolves a working directory to a display label.
//
// When a cwd lives inside a git worktree (recognised by a regular `.git`
// FILE whose body is `gitdir: <path>/.git/worktrees/<name>`), the label
// becomes `<main-repo-name> (<worktree-name>)` so dashboards don't show
// just the worktree leaf (e.g. "playwright") and lose track of which
// project it belongs to (e.g. "ai-self-web (playwright)").
//
// For non-worktree cwds, the label falls back to the plain basename —
// identical to `projectNameFromCwd` in `lib/utils.ts`.
//
// Implementation notes:
// - sync IO (`readFileSync`/`statSync`) — called from synchronous serialize
//   paths. Each cwd hits disk at most once per process; subsequent lookups
//   are O(1) via the in-memory cache.
// - never throws; any IO error falls back to the plain basename.
// - DO NOT import this from client components; it pulls in `node:fs`.
//
// Cache lifetime: the cache lives for the whole process and is NEVER
// evicted. If a user renames a git worktree or restructures `.git/worktrees`
// while the dashboard is running, that cwd's label will be stale until the
// process restarts. Acceptable trade-off because:
//  - worktree rename is rare and user-initiated
//  - the indexer's parserVersion bumps already force a restart on parser
//    changes, so the cache effectively renews on every release upgrade
//  - the alternative (`statSync` per render) would noticeably slow down
//    the usage table on large histories.

import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { projectNameFromCwd } from './utils';

interface LabelResult {
  /** Final display string. e.g. `"ai-self-web (playwright)"` */
  label: string;
  /** True iff worktree detection succeeded. */
  isWorktree: boolean;
  /** Underlying main-repo name (== plain projectName when not a worktree). */
  mainName: string;
  /** Worktree leaf name when isWorktree, otherwise empty. */
  worktreeName: string;
}

const cache = new Map<string, LabelResult>();

// Match the canonical layout produced by `git worktree add`:
//   gitdir: <main-repo>/.git/worktrees/<wt-name>
// Allow trailing newline / whitespace and an optional final slash.
const GITDIR_PATTERN = /^(.+?)[/\\]\.git[/\\]worktrees[/\\]([^/\\]+)[/\\]?$/;

function resolveRaw(cwd: string): LabelResult {
  const fallbackName = projectNameFromCwd(cwd);
  if (!cwd) {
    return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '' };
  }
  try {
    const gitPath = `${cwd}/.git`;
    const s = statSync(gitPath);
    // A real (non-worktree) repo has `.git/` as a DIRECTORY.
    // A worktree has `.git` as a small FILE pointing back to the main repo.
    if (!s.isFile()) {
      return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '' };
    }
    const text = readFileSync(gitPath, 'utf8').trim();
    // Take the first non-empty line — git only writes `gitdir: ...` but
    // be defensive against future additions.
    const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
    const m = /^gitdir:\s*(.+)$/.exec(firstLine);
    if (!m) {
      return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '' };
    }
    const gitdir = m[1].trim();
    const wt = GITDIR_PATTERN.exec(gitdir);
    if (!wt) {
      // Linked-but-non-standard gitdir layout. Keep plain basename.
      return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '' };
    }
    const mainRepoPath = wt[1];
    const worktreeName = wt[2];
    const mainName = basename(mainRepoPath) || mainRepoPath;
    return {
      label: `${mainName} (${worktreeName})`,
      isWorktree: true,
      mainName,
      worktreeName,
    };
  } catch {
    return { label: fallbackName, isWorktree: false, mainName: fallbackName, worktreeName: '' };
  }
}

/** Cached worktree-aware project label for a cwd. Stable for the lifetime
 *  of the process; worktrees almost never move while the dashboard runs. */
export function resolveProjectLabel(cwd: string): string {
  const cached = cache.get(cwd);
  if (cached) return cached.label;
  const r = resolveRaw(cwd);
  cache.set(cwd, r);
  return r.label;
}

/** Same lookup, but returns the structured result. Useful when callers
 *  need the raw main name or worktree name separately (e.g. CSV export). */
export function resolveProjectMeta(cwd: string): LabelResult {
  const cached = cache.get(cwd);
  if (cached) return cached;
  const r = resolveRaw(cwd);
  cache.set(cwd, r);
  return r;
}

/** Test helper. Clears the in-process label cache. */
export function clearProjectLabelCache(): void {
  cache.clear();
}
