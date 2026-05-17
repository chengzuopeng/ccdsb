// Web-side helpers for the "All" source view.
//
// The web pages never pass `source: 'all'` to the aggregator — the aggregator
// strictly requires a single ProviderId. Instead, when source is 'all', the
// page (or API route) runs each aggregator ONCE per provider and uses the
// helpers in this file to merge numeric results into a single flat output.
//
// This mirrors what `lib/mcp/formatters.ts` does for the MCP server, but
// without wrapping into the `bySource` shape — MCP needs both halves so the
// LLM can answer per-provider questions; the web UI just wants merged
// numbers to render in regular KPI cards / charts.
//
// List-style aggregators (model / project / session) DON'T need a merge
// helper. Pages run them per source and `.flatMap` the results: each output
// entry already carries its own `source` field, so concatenation is enough.

import type { AggregateBucket } from './types';

export interface Totals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  cost: number;
  saved: number;
  requests: number;
}

const ZERO: Totals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalTokens: 0,
  cost: 0,
  saved: 0,
  requests: 0,
};

/** Sum numeric fields across N totals snapshots. Used when source='all'. */
export function combineTotals(parts: Totals[]): Totals {
  if (parts.length === 0) return { ...ZERO };
  if (parts.length === 1) return parts[0];
  return parts.reduce(
    (acc, p) => ({
      inputTokens: acc.inputTokens + p.inputTokens,
      outputTokens: acc.outputTokens + p.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + p.cacheReadTokens,
      cacheCreationTokens: acc.cacheCreationTokens + p.cacheCreationTokens,
      totalTokens: acc.totalTokens + p.totalTokens,
      cost: acc.cost + p.cost,
      saved: acc.saved + p.saved,
      requests: acc.requests + p.requests,
    }),
    { ...ZERO },
  );
}

/** Merge per-source time-series into a single combined series.
 *
 *  Buckets with the same `key` (e.g. same day for daily granularity) are
 *  merged by summing the numeric fields. Models maps are unioned (each
 *  source contributes its own model entries, which don't collide because
 *  Claude / OpenAI use disjoint model name spaces).
 *
 *  Returns the merged buckets sorted by key ascending (same convention as
 *  `aggregateByTime`). */
export function combineTimeBuckets(perSource: AggregateBucket[][]): AggregateBucket[] {
  if (perSource.length === 0) return [];
  if (perSource.length === 1) return perSource[0];
  const merged = new Map<string, AggregateBucket>();
  for (const series of perSource) {
    for (const b of series) {
      const existing = merged.get(b.key);
      if (!existing) {
        // Deep-clone the bucket AND every entry in its `models` map.
        // Shallow-cloning the outer map alone would leave the model
        // entries shared with the caller's input — and the merge loop
        // below mutates those entries in place, which would corrupt
        // the indexer's cached aggregator output. (See test-source-merge.mjs.)
        merged.set(b.key, {
          ...b,
          models: cloneModelsMap(b.models),
        });
        continue;
      }
      existing.inputTokens += b.inputTokens;
      existing.outputTokens += b.outputTokens;
      existing.cacheReadTokens += b.cacheReadTokens;
      existing.cacheCreationTokens += b.cacheCreationTokens;
      existing.totalTokens += b.totalTokens;
      existing.cost += b.cost;
      existing.saved += b.saved;
      existing.requests += b.requests;
      for (const [modelName, m] of Object.entries(b.models)) {
        const cur = existing.models[modelName] ?? { tokens: 0, cost: 0, requests: 0 };
        cur.tokens += m.tokens;
        cur.cost += m.cost;
        cur.requests += m.requests;
        existing.models[modelName] = cur;
      }
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.key.localeCompare(b.key));
}

function cloneModelsMap(
  src: AggregateBucket['models'],
): AggregateBucket['models'] {
  const out: AggregateBucket['models'] = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = { tokens: v.tokens, cost: v.cost, requests: v.requests };
  }
  return out;
}
