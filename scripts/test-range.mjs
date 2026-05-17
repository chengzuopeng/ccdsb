#!/usr/bin/env node --experimental-strip-types --no-warnings
/**
 * Smoke test for `lib/range.ts` — the dashboard's URL `?range=...` parser.
 *
 * NOTE on day-alignment: as of 1.0.3 the MCP server's `parseDateRange`
 * (lib/mcp/context.ts) snaps `7d/30d/90d` to `[start-of(N-1 days ago),
 * end-of-today]` so that summing N `daily_summary` calls equals one
 * `usage_summary({range:"7d"})`. The DASHBOARD's `rangeToDates`
 * (this file) still uses ROLLING `now − N days, ∞]` semantics. This
 * test pins the dashboard behaviour as currently shipped; if the two
 * paths are unified later, update this test in lockstep.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));

const { isUsageRange, normalizeUsageRange, rangeToDates, USAGE_RANGES } = await import(
  join(root, 'lib/range.ts')
);

// ── USAGE_RANGES is the source of truth ───────────────────────────────
{
  assert.deepEqual(
    [...USAGE_RANGES],
    ['1d', '7d', '30d', '90d', 'all'],
    'USAGE_RANGES enumerates the dashboard URL options',
  );
  console.log('✓ USAGE_RANGES literal is fixed');
}

// ── isUsageRange type guard ───────────────────────────────────────────
{
  assert.equal(isUsageRange('7d'), true);
  assert.equal(isUsageRange('30d'), true);
  assert.equal(isUsageRange('all'), true);
  assert.equal(isUsageRange('1d'), true);
  assert.equal(isUsageRange('14d'), false, '14d is NOT in USAGE_RANGES');
  assert.equal(isUsageRange(''), false);
  assert.equal(isUsageRange(null), false);
  assert.equal(isUsageRange(undefined), false);
  assert.equal(isUsageRange(7), false, 'number is not a UsageRange');
  console.log('✓ isUsageRange: accepts canonical values, rejects everything else');
}

// ── normalizeUsageRange falls back ────────────────────────────────────
{
  assert.equal(normalizeUsageRange('7d'), '7d');
  assert.equal(normalizeUsageRange('garbage'), '7d', 'default fallback is 7d');
  assert.equal(normalizeUsageRange(null, '30d'), '30d', 'explicit fallback honored');
  assert.equal(normalizeUsageRange(undefined), '7d');
  assert.equal(normalizeUsageRange(''), '7d', 'empty string falls back');
  console.log('✓ normalizeUsageRange: invalid → fallback, valid → pass-through');
}

// ── rangeToDates: `all` → no bounds ───────────────────────────────────
{
  const r = rangeToDates('all');
  assert.equal(r.from, undefined, '`all` has no `from`');
  assert.equal(r.to, undefined, '`all` has no `to`');
  console.log('✓ rangeToDates(all): no bounds');
}

// ── rangeToDates: `1d` → from = start of today ────────────────────────
{
  const r = rangeToDates('1d');
  assert.ok(r.from instanceof Date, '`1d` has a Date `from`');
  assert.equal(r.from.getHours(), 0, '`1d` start is midnight (day-aligned)');
  assert.equal(r.from.getMinutes(), 0);
  assert.equal(r.from.getSeconds(), 0);
  const today = new Date();
  assert.equal(r.from.getDate(), today.getDate(), '`1d` start is today');
  assert.equal(r.to, undefined, '`1d` has no upper bound');
  console.log('✓ rangeToDates(1d): from = start of today, to = open');
}

// ── rangeToDates: `7d` → from = now − 7 days (ROLLING, not snapped) ──
//   Pinned behaviour: the dashboard's 7d is a rolling 7×24h window.
//   This DIFFERS from MCP's parseDateRange which day-aligns to
//   [start-of(N-1 days ago), end-of-today]. See file header.
{
  const before = Date.now();
  const r = rangeToDates('7d');
  const after = Date.now();
  assert.ok(r.from instanceof Date);
  assert.equal(r.to, undefined, '`7d` upper bound is open');
  const delta = r.from.getTime() - (before - 7 * 24 * 60 * 60 * 1000);
  assert.ok(
    Math.abs(delta) < (after - before) + 100,
    `\`7d\` from ≈ now − 7d (rolling, not day-aligned); delta=${delta}ms`,
  );
  console.log('✓ rangeToDates(7d): rolling 7-day window (NOT day-aligned, by design)');
}

// ── 30d / 90d: same rolling semantics ─────────────────────────────────
{
  const now = Date.now();
  const r30 = rangeToDates('30d');
  const r90 = rangeToDates('90d');
  // Both are rolling — `from` is now minus N×24h, give or take a few ms.
  assert.ok(
    Math.abs(r30.from.getTime() - (now - 30 * 24 * 60 * 60 * 1000)) < 1000,
    '`30d` from ≈ now − 30d',
  );
  assert.ok(
    Math.abs(r90.from.getTime() - (now - 90 * 24 * 60 * 60 * 1000)) < 1000,
    '`90d` from ≈ now − 90d',
  );
  assert.equal(r30.to, undefined);
  assert.equal(r90.to, undefined);
  console.log('✓ rangeToDates(30d / 90d): rolling N-day windows');
}

console.log('\nAll range assertions passed.');
