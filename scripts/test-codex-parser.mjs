#!/usr/bin/env node --experimental-strip-types --no-warnings
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const root = dirname(dirname(__filename));

// Use Node's built-in TS strip support to import .ts directly.
const { parseCodexJsonlFile } = await import(join(root, 'lib/providers/codex/parse-codex-jsonl.ts'));
const { resolveCodexPricing, BUILTIN_PRICING_OPENAI } = await import(join(root, 'lib/providers/codex/pricing.ts'));
const { costFromUsage } = await import(join(root, 'lib/pricing/cost-from-usage.ts'));
const { shortenCodexModel } = await import(join(root, 'lib/providers/codex/shorten-model.ts'));

const fixture = join(root, 'lib/providers/codex/__fixtures__/sample.jsonl');
const parsed = await parseCodexJsonlFile(fixture);

console.log(`parsed: ${parsed.assistant.length} assistant, ${parsed.user.length} user, ${parsed.parentLinks.length} parentLinks`);

assert.equal(parsed.assistant.length, 3, 'should emit 3 AssistantRecords');
assert.equal(parsed.user.length, 1, 'should emit 1 UserRecord');

for (const r of parsed.assistant) assert.equal(r.source, 'codex');
assert.equal(parsed.user[0].source, 'codex');

const a = parsed.assistant;
const sumInput = a.reduce((s, r) => s + r.usage.input_tokens, 0);
const sumCacheRead = a.reduce((s, r) => s + r.usage.cache_read_input_tokens, 0);
const sumOutput = a.reduce((s, r) => s + r.usage.output_tokens, 0);
const sumReasoning = a.reduce((s, r) => s + (r.usage.reasoning_tokens ?? 0), 0);
assert.equal(sumInput, 1500, 'input_tokens after subtracting cached');
assert.equal(sumCacheRead, 2000, 'cached_input_tokens flows to cache_read');
assert.equal(sumOutput, 260, 'output + reasoning merged into output_tokens');
// Each emitted record should also expose reasoning as a display-only breakdown
// (subset of output_tokens; not counted again in totals/cost).
assert.equal(sumReasoning, 60, 'reasoning_tokens (display-only) is present per record');
for (const rec of a) {
  if (rec.usage.reasoning_tokens && rec.usage.reasoning_tokens > 0) {
    assert.ok(
      rec.usage.output_tokens >= rec.usage.reasoning_tokens,
      `output_tokens (${rec.usage.output_tokens}) must include reasoning_tokens (${rec.usage.reasoning_tokens})`,
    );
  }
}

assert.equal(a[0].model, 'gpt-5');
assert.equal(a[1].model, 'gpt-5');
assert.equal(a[2].model, 'gpt-5-mini');
assert.equal(a[2].cwd, '/Users/test/proj-other', 'turn_context cwd switch');

assert.deepEqual(a[0].toolNames, ['shell_command']);
assert.equal(a[0].hasThinking, true);
assert.equal(a[0].textPreview, 'Looking at the code now');
assert.deepEqual(a[1].toolNames, ['apply_patch']);
assert.equal(a[1].hasThinking, false);
assert.equal(a[1].textPreview, '');

assert.equal(a[0].parentUuid, parsed.user[0].uuid);
assert.equal(a[1].parentUuid, parsed.user[0].uuid);
assert.equal(a[2].parentUuid, parsed.user[0].uuid);

assert.ok(a[0].requestId.startsWith('turn-1::'));
assert.ok(a[2].requestId.startsWith('turn-2::'));

const r = resolveCodexPricing('gpt-5');
assert.equal(r.matchType, 'exact');
const c = costFromUsage(
  {
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_creation_5m: 0,
    cache_creation_1h: 0,
  },
  r.pricing,
);
assert.equal(c.total.toFixed(2), '11.25', 'gpt-5 cost: 1M input * 1.25 + 1M output * 10');

assert.equal(shortenCodexModel('gpt-5'), 'GPT-5');
assert.equal(shortenCodexModel('gpt-5-mini'), 'GPT-5 Mini');
assert.equal(shortenCodexModel('gpt-5-nano'), 'GPT-5 Nano');

const r2 = resolveCodexPricing('gpt-7-future');
assert.equal(r2.matchType, 'family-fallback');
assert.ok(r2.pricing);

const r3 = resolveCodexPricing('o5-omega');
assert.equal(r3.matchType, 'family-fallback');
assert.ok(r3.pricing);

assert.ok('gpt-5' in BUILTIN_PRICING_OPENAI);
assert.ok('gpt-5-mini' in BUILTIN_PRICING_OPENAI);

console.log('\nAll codex parser + pricing assertions passed.');
