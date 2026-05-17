#!/usr/bin/env node --experimental-strip-types --no-warnings
/**
 * Smoke test for `lib/pricing/cost-from-usage.ts`.
 *
 * The trickiest piece is the 5m vs 1h cache-creation bucketing:
 *   - Modern Claude JSONL emits `cache_creation_5m` / `cache_creation_1h`
 *     separately and `cache_creation_input_tokens` is the SUM of the two.
 *   - Older JSONL only has `cache_creation_input_tokens` (the total).
 *
 * The code path falls back to "all in the 5m bucket" iff both 5m + 1h
 * are zero AND the legacy total is non-zero. This test pins that
 * behaviour so a future refactor doesn't accidentally double-count.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));

const { costFromUsage, totalTokens } = await import(
  join(root, 'lib/pricing/cost-from-usage.ts')
);

// Realistic per-million-token rates (rough Claude Opus shape).
const PRICING = {
  input: 15,
  output: 75,
  cacheCreation5m: 18.75, // 1.25× input
  cacheCreation1h: 30, // 2× input
  cacheRead: 1.5, // 0.1× input
};

const ZERO_USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_5m: 0,
  cache_creation_1h: 0,
};

// ── null pricing yields zeros ──────────────────────────────────────────
{
  const c = costFromUsage(
    { ...ZERO_USAGE, input_tokens: 1_000_000, output_tokens: 1_000_000 },
    null,
  );
  assert.equal(c.total, 0);
  assert.equal(c.input, 0);
  assert.equal(c.output, 0);
  assert.equal(c.cacheCreation5m, 0);
  assert.equal(c.cacheCreation1h, 0);
  assert.equal(c.cacheRead, 0);
  assert.equal(c.saved, 0);
  console.log('✓ null pricing → all zeros');
}

// ── basic input + output math ──────────────────────────────────────────
{
  const c = costFromUsage(
    { ...ZERO_USAGE, input_tokens: 500_000, output_tokens: 200_000 },
    PRICING,
  );
  assert.equal(c.input.toFixed(2), '7.50', '500k @ $15/M = $7.50');
  assert.equal(c.output.toFixed(2), '15.00', '200k @ $75/M = $15.00');
  assert.equal(c.total.toFixed(2), '22.50');
  assert.equal(c.saved, 0, 'no cache reads → no savings');
  console.log('✓ basic input + output pricing math');
}

// ── new-shape: 5m + 1h split is respected, legacy total IGNORED ───────
{
  const c = costFromUsage(
    {
      ...ZERO_USAGE,
      cache_creation_5m: 1_000_000,
      cache_creation_1h: 2_000_000,
      // Legacy aggregate. The function MUST NOT add this on top — it'd
      // double-count cache writes.
      cache_creation_input_tokens: 3_000_000,
    },
    PRICING,
  );
  assert.equal(c.cacheCreation5m.toFixed(2), '18.75', '1M @ $18.75/M');
  assert.equal(c.cacheCreation1h.toFixed(2), '60.00', '2M @ $30/M');
  assert.equal(c.total.toFixed(2), '78.75', 'NO double-count of legacy aggregate');
  console.log('✓ new-shape (5m + 1h split): legacy aggregate is ignored');
}

// ── legacy-shape: only `cache_creation_input_tokens` set ──────────────
//   Falls back to "all tokens are 5m bucket". Pinned behaviour — older
//   transcripts billed at 5m rate is the safe lower-bound default.
{
  const c = costFromUsage(
    {
      ...ZERO_USAGE,
      cache_creation_5m: 0,
      cache_creation_1h: 0,
      cache_creation_input_tokens: 2_000_000,
    },
    PRICING,
  );
  assert.equal(c.cacheCreation5m.toFixed(2), '37.50', 'legacy: 2M @ $18.75/M (5m rate)');
  assert.equal(c.cacheCreation1h, 0);
  assert.equal(c.total.toFixed(2), '37.50');
  console.log('✓ legacy-shape (no 5m/1h split): falls back to 5m rate');
}

// ── cache reads + saved-vs-full-input ─────────────────────────────────
{
  const c = costFromUsage(
    {
      ...ZERO_USAGE,
      cache_read_input_tokens: 4_000_000,
    },
    PRICING,
  );
  assert.equal(c.cacheRead.toFixed(2), '6.00', '4M @ $1.50/M');
  // Without cache: would have cost 4M × $15 input rate = $60.
  // With cache: $6. Saved: $54.
  assert.equal(c.saved.toFixed(2), '54.00', 'saved = full-input − cache-read price');
  assert.equal(c.total.toFixed(2), '6.00');
  console.log('✓ cache read: cost + saved-vs-full-input');
}

// ── totalTokens helper ────────────────────────────────────────────────
{
  const usage = {
    ...ZERO_USAGE,
    input_tokens: 100,
    output_tokens: 200,
    cache_read_input_tokens: 300,
    cache_creation_input_tokens: 50,
  };
  assert.equal(totalTokens(usage), 650, '100 + 200 + 300 + 50');
  console.log('✓ totalTokens sums all four counters');
}

// ── all-buckets-zero is safe ──────────────────────────────────────────
{
  const c = costFromUsage(ZERO_USAGE, PRICING);
  assert.equal(c.total, 0);
  assert.equal(c.saved, 0);
  console.log('✓ all-zero usage → zero cost (no NaN)');
}

// ── tiny fractional tokens don\'t blow up ──────────────────────────────
//   The function does floating-point division; ensure 1-token requests
//   don't underflow to 0 in the breakdown.
{
  const c = costFromUsage(
    { ...ZERO_USAGE, input_tokens: 1, output_tokens: 1 },
    PRICING,
  );
  assert.ok(c.input > 0, '1 input token has nonzero cost');
  assert.ok(c.output > 0, '1 output token has nonzero cost');
  assert.equal((c.input * 1e6).toFixed(2), '15.00', '1 token × $15/M scales linearly');
  console.log('✓ single-token requests scale linearly without underflow');
}

console.log('\nAll cost-from-usage assertions passed.');
