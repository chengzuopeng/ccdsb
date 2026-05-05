import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  granularitySchema,
  rangeArgsSchema,
  sourceArgs,
  type SourceArg,
} from '../schema';
import { getMcpIndexerReady, parseDateRange } from '../context';
import {
  modelEntries,
  projectEntries,
  sessionEntries,
  timeBuckets,
  totalsWithBySource,
} from '../formatters';

function asTextResult(payload: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function registerUsageTools(server: McpServer): void {
  // ── usage_summary ──
  server.registerTool(
    'usage_summary',
    {
      title: 'Usage summary',
      description:
        'Total tokens and dollar-equivalent cost for a date range. When source="all" (default), the response includes a per-source breakdown alongside combined totals so the LLM can answer either provider-specific or combined questions in a single call.',
      inputSchema: {
        ...rangeArgsSchema,
        ...sourceArgs,
      },
    },
    async (args) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const range = parseDateRange(args);
      const source = (args.source ?? 'all') as SourceArg;
      const result = totalsWithBySource(snap.records, source, {
        from: range.from,
        to: range.to,
      });
      return asTextResult({
        range_label: range.label,
        from: range.from?.toISOString(),
        to: range.to?.toISOString(),
        source,
        ...result,
      });
    },
  );

  // ── usage_by_time ──
  server.registerTool(
    'usage_by_time',
    {
      title: 'Usage by time',
      description:
        'Time-series of usage and cost, bucketed by hour/day/week/month. Useful for "draw me a trend" or "when does usage spike" questions. Each bucket carries combined totals plus a bySource map (for source="all").',
      inputSchema: {
        ...rangeArgsSchema,
        ...sourceArgs,
        granularity: granularitySchema.describe('hour | day | week | month (default: day)'),
      },
    },
    async (args) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const range = parseDateRange(args);
      const source = (args.source ?? 'all') as SourceArg;
      const granularity = args.granularity ?? 'day';
      const buckets = timeBuckets(snap.records, source, granularity, {
        from: range.from,
        to: range.to,
      });
      return asTextResult({
        range_label: range.label,
        from: range.from?.toISOString(),
        to: range.to?.toISOString(),
        source,
        granularity,
        bucket_count: buckets.length,
        buckets,
      });
    },
  );

  // ── usage_by_model ──
  server.registerTool(
    'usage_by_model',
    {
      title: 'Usage by model',
      description:
        'Per-model usage and cost for a date range. Each entry carries its `source` so you can group by provider client-side. Sorted by cost desc.',
      inputSchema: {
        ...rangeArgsSchema,
        ...sourceArgs,
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe('Cap to top N entries by cost. Default: no cap.'),
      },
    },
    async (args) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const range = parseDateRange(args);
      const source = (args.source ?? 'all') as SourceArg;
      let entries = modelEntries(snap.records, source, {
        from: range.from,
        to: range.to,
      });
      if (args.limit) entries = entries.slice(0, args.limit);
      return asTextResult({
        range_label: range.label,
        source,
        count: entries.length,
        models: entries,
      });
    },
  );

  // ── usage_by_project ──
  server.registerTool(
    'usage_by_project',
    {
      title: 'Usage by project',
      description:
        'Per-project (working directory) usage and cost. Useful for answering "which project is eating my budget" or "what have I worked on this month". Sorted by cost desc.',
      inputSchema: {
        ...rangeArgsSchema,
        ...sourceArgs,
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Cap to top N projects by cost.'),
      },
    },
    async (args) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const range = parseDateRange(args);
      const source = (args.source ?? 'all') as SourceArg;
      let entries = projectEntries(snap.records, source, {
        from: range.from,
        to: range.to,
      });
      if (args.limit) entries = entries.slice(0, args.limit);
      return asTextResult({
        range_label: range.label,
        source,
        count: entries.length,
        projects: entries,
      });
    },
  );

  // ── usage_by_session ──
  server.registerTool(
    'usage_by_session',
    {
      title: 'Usage by session',
      description:
        'Per-session list with each session\'s first user message (as title), models used, duration, tokens and cost. Default sort is most-recent first; use `sort` to switch.',
      inputSchema: {
        ...rangeArgsSchema,
        ...sourceArgs,
        sort: z
          .enum(['recent', 'cost', 'tokens', 'duration'])
          .default('recent')
          .describe('recent (default) | cost | tokens | duration. Always desc.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(25)
          .describe('Max sessions to return. Default 25.'),
      },
    },
    async (args) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const range = parseDateRange(args);
      const source = (args.source ?? 'all') as SourceArg;
      const sort = args.sort ?? 'recent';
      const limit = args.limit ?? 25;
      let entries = sessionEntries(snap.records, snap.userRecords, source, {
        from: range.from,
        to: range.to,
      });
      switch (sort) {
        case 'cost':
          entries.sort((a, b) => b.cost_usd - a.cost_usd);
          break;
        case 'tokens':
          entries.sort((a, b) => b.total_tokens - a.total_tokens);
          break;
        case 'duration':
          entries.sort((a, b) => b.duration_ms - a.duration_ms);
          break;
        case 'recent':
        default:
          entries.sort((a, b) => b.end_time.localeCompare(a.end_time));
      }
      const total = entries.length;
      entries = entries.slice(0, limit);
      return asTextResult({
        range_label: range.label,
        source,
        sort,
        total_count: total,
        returned_count: entries.length,
        sessions: entries,
      });
    },
  );
}
