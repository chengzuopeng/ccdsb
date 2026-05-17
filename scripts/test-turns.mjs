#!/usr/bin/env node --experimental-strip-types --no-warnings
/**
 * Smoke test for `lib/turns.ts#buildTurnIndex`.
 *
 * The turn-grouping logic has been the source of two correctness fixes:
 *   v3: skip `isSynthetic` user records (skill metadata, <system-reminder>)
 *       so they don't fragment one conversation into multiple turns.
 *   v4: merge sub-agent (`subagents/agent-*.jsonl`) records — their first
 *       user record is `isSynthetic` so they collapse into the parent.
 *
 * Both regressions were silent — wrong row counts in the usage table.
 * This test asserts the contract: a turnIndex maps every assistant to
 * the nearest real user ancestor, NOT to a synthetic injection.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));

const { buildTurnIndex } = await import(join(root, 'lib/turns.ts'));

// Minimal fixture helpers — only emit the fields buildTurnIndex reads.
function user(uuid, textPreview, opts = {}) {
  return { uuid, textPreview, isSynthetic: opts.isSynthetic ?? false };
}
function assistant(uuid) {
  return { uuid };
}

// ── Scenario 1: linear turn ────────────────────────────────────────────
//   user-A → assistant-1 → assistant-2 → assistant-3
//   Expect: all three assistants map to user-A.
{
  const users = [user('user-A', 'Hello, can you help me?')];
  const assistants = [assistant('asst-1'), assistant('asst-2'), assistant('asst-3')];
  const parentMap = {
    'asst-1': 'user-A',
    'asst-2': 'asst-1',
    'asst-3': 'asst-2',
    'user-A': null,
  };
  const index = buildTurnIndex(assistants, users, parentMap);
  assert.equal(index.get('asst-1'), 'user-A', 'linear: asst-1 → user-A');
  assert.equal(index.get('asst-2'), 'user-A', 'linear: asst-2 → user-A (transitively)');
  assert.equal(index.get('asst-3'), 'user-A', 'linear: asst-3 → user-A (transitively)');
  console.log('✓ scenario 1: linear turn collapses to the user root');
}

// ── Scenario 2: synthetic injection (Skill metadata) ───────────────────
//   user-A → assistant-1 (model decides to invoke Skill)
//          → synth-1 ("Base directory for this skill: ...")
//          → assistant-2 (Skill runs)
//          → assistant-3
//   Expect: ALL assistants map to user-A — the synthetic user is invisible
//   to turn-boundary detection. This was the v3 bug.
{
  const users = [
    user('user-A', 'Please run the mf-commit skill'),
    user('synth-1', 'Base directory for this skill: ~/.claude/skills/mf-commit', {
      isSynthetic: true,
    }),
  ];
  const assistants = [assistant('asst-1'), assistant('asst-2'), assistant('asst-3')];
  const parentMap = {
    'asst-1': 'user-A',
    'synth-1': 'asst-1',
    'asst-2': 'synth-1',
    'asst-3': 'asst-2',
    'user-A': null,
  };
  const index = buildTurnIndex(assistants, users, parentMap);
  assert.equal(index.get('asst-1'), 'user-A', 'synthetic: asst-1 → user-A');
  assert.equal(
    index.get('asst-2'),
    'user-A',
    'synthetic: asst-2 must skip synth-1 and reach user-A (v3 regression site)',
  );
  assert.equal(index.get('asst-3'), 'user-A', 'synthetic: asst-3 → user-A (transitively)');
  console.log('✓ scenario 2: synthetic user injection is skipped as a turn root');
}

// ── Scenario 3: <system-reminder> mid-stream ───────────────────────────
//   user-A → asst-1 → synth-reminder (system reminder) → asst-2
//   Same expectation as scenario 2 — different synthetic flavor.
{
  const users = [
    user('user-A', 'Run my failing tests'),
    user('synth-r', '<system-reminder>TodoWrite hasn\'t been used recently...</system-reminder>', {
      isSynthetic: true,
    }),
  ];
  const assistants = [assistant('asst-1'), assistant('asst-2')];
  const parentMap = {
    'asst-1': 'user-A',
    'synth-r': 'asst-1',
    'asst-2': 'synth-r',
    'user-A': null,
  };
  const index = buildTurnIndex(assistants, users, parentMap);
  assert.equal(index.get('asst-2'), 'user-A', 'reminder: asst-2 → user-A (not synth-r)');
  console.log('✓ scenario 3: <system-reminder> synthetic user is skipped');
}

// ── Scenario 4: two real users (two turns) ─────────────────────────────
{
  const users = [user('user-A', 'first prompt'), user('user-B', 'second prompt')];
  const assistants = [assistant('asst-A1'), assistant('asst-B1'), assistant('asst-B2')];
  const parentMap = {
    'asst-A1': 'user-A',
    'asst-B1': 'user-B',
    'asst-B2': 'asst-B1',
    'user-A': null,
    'user-B': 'asst-A1',
  };
  const index = buildTurnIndex(assistants, users, parentMap);
  assert.equal(index.get('asst-A1'), 'user-A');
  assert.equal(index.get('asst-B1'), 'user-B');
  assert.equal(index.get('asst-B2'), 'user-B');
  console.log('✓ scenario 4: two real users root two separate turns');
}

// ── Scenario 5: orphan assistant (no real user ancestor) ───────────────
//   Common after dedup or for the first assistant in a fragment file.
//   The contract: fall back to the assistant's own uuid as its turn id.
{
  const users = [
    user('synth-only', 'Base directory for this skill: ~/.claude/skills/orphan', {
      isSynthetic: true,
    }),
  ];
  const assistants = [assistant('orphan-asst')];
  const parentMap = {
    'orphan-asst': 'synth-only',
    'synth-only': null,
  };
  const index = buildTurnIndex(assistants, users, parentMap);
  assert.equal(
    index.get('orphan-asst'),
    'orphan-asst',
    'orphan: assistant with no real user ancestor uses its own uuid',
  );
  console.log('✓ scenario 5: orphan assistant falls back to its own uuid');
}

// ── Scenario 6: user with empty textPreview is also skipped ────────────
//   The implementation requires `textPreview && textPreview.trim()` —
//   a user record that exists but has no text doesn't anchor a turn.
{
  const users = [
    user('user-empty', ''),
    user('user-real', 'real prompt'),
  ];
  const assistants = [assistant('asst-1')];
  const parentMap = {
    'asst-1': 'user-empty',
    'user-empty': 'user-real',
    'user-real': null,
  };
  const index = buildTurnIndex(assistants, users, parentMap);
  assert.equal(
    index.get('asst-1'),
    'user-real',
    'empty-text user is invisible; walk continues to user-real',
  );
  console.log('✓ scenario 6: user with empty textPreview is invisible to turn detection');
}

// ── Scenario 7: cycle defense ──────────────────────────────────────────
//   Malformed JSONL could in principle produce a parentUuid cycle.
//   Contract: don't infinite-loop; fall back to the assistant's own uuid.
{
  const users = [];
  const assistants = [assistant('asst-cycle-1'), assistant('asst-cycle-2')];
  const parentMap = {
    'asst-cycle-1': 'asst-cycle-2',
    'asst-cycle-2': 'asst-cycle-1',
  };
  const index = buildTurnIndex(assistants, users, parentMap);
  // Both should resolve to themselves (or each other) without hanging.
  assert.ok(
    index.has('asst-cycle-1') && index.has('asst-cycle-2'),
    'cycle: both assistants get a (fallback) turn id without hanging',
  );
  console.log('✓ scenario 7: parentUuid cycle is broken (no infinite loop)');
}

console.log('\nAll turn-grouping assertions passed.');
