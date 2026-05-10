import { getIndexer } from '@/lib/data-loader/indexer';
import type { ProviderId } from '@/lib/types';
import { atEndOfDay, atStartOfDay, parseDateLike } from '@/lib/date-utils';

/** Cache namespace for the MCP server's own indexer instance. Keeps it
 *  disjoint from the web dashboard's persisted file. */
export const MCP_INDEX_NAME = 'mcp';

/** Get (and lazily init) the MCP-scoped indexer. The first call kicks off
 *  the full scan; subsequent calls are O(1). */
export async function getMcpIndexerReady() {
  const idx = getIndexer(MCP_INDEX_NAME);
  await idx.init();
  return idx;
}

export type EffectiveSource = ProviderId | 'all';

/** Convert a date-range tool arg into [from, to] Date objects.
 *
 *  Strict: throws if `from`/`to` can't be parsed, or if `range` isn't a
 *  known value. The schema layer should already reject these, but we
 *  re-check here so any bypass surfaces as a clear MCP error instead of
 *  silently returning all-time data (which would mislead the LLM into
 *  thinking it answered the user's actual question).
 *
 *  Returns { from?, to?, label } — `undefined` bounds mean "open on that
 *  side", which only happens for the explicit `range: "all"` choice. */
export function parseDateRange(args: {
  range?: string;
  from?: string;
  to?: string;
}): { from?: Date; to?: Date; label: string } {
  const explicitFrom = args.from ? parseStrictDate(args.from, 'from', false) : undefined;
  const explicitTo = args.to ? parseStrictDate(args.to, 'to', true) : undefined;
  if (explicitFrom || explicitTo) {
    const label =
      explicitFrom && explicitTo
        ? `${args.from} → ${args.to}`
        : explicitFrom
          ? `from ${args.from}`
          : `until ${args.to}`;
    return { from: explicitFrom, to: explicitTo, label };
  }

  const range = (args.range || 'all').toLowerCase();
  const now = new Date();
  const startOfToday = atStartOfDay(now);
  const endOfToday = atEndOfDay(now);

  switch (range) {
    case 'today':
      return { from: startOfToday, to: endOfToday, label: 'today' };
    case 'yesterday': {
      const y = new Date(startOfToday);
      y.setDate(y.getDate() - 1);
      const yEnd = atEndOfDay(y);
      return { from: y, to: yEnd, label: 'yesterday' };
    }
    case 'this_week': {
      const monday = startOfWeek(now);
      return { from: monday, to: endOfToday, label: 'this_week' };
    }
    case 'last_week': {
      const monday = startOfWeek(now);
      const start = new Date(monday);
      start.setDate(start.getDate() - 7);
      const end = new Date(monday);
      end.setMilliseconds(end.getMilliseconds() - 1);
      return { from: start, to: end, label: 'last_week' };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: start, to: endOfToday, label: 'this_month' };
    }
    case 'last_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      end.setMilliseconds(end.getMilliseconds() - 1);
      return { from: start, to: end, label: 'last_month' };
    }
    case 'all':
      return { label: 'all' };
    case '7d':
    case '30d':
    case '90d': {
      const n = parseInt(range, 10);
      const start = new Date(now);
      start.setDate(start.getDate() - n);
      return { from: start, to: now, label: range };
    }
    default:
      throw new Error(
        `invalid 'range' argument: ${JSON.stringify(args.range)}. ` +
          `Expected one of: today, yesterday, this_week, last_week, this_month, last_month, 7d, 30d, 90d, all.`,
      );
  }
}

function parseStrictDate(s: string, field: 'from' | 'to', isUpperBound: boolean): Date {
  const dt = parseDateLike(s, { upperBoundDateOnly: isUpperBound });
  if (!dt) {
    throw new Error(
      `invalid '${field}' argument: ${JSON.stringify(s)}. Expected YYYY-MM-DD or a full ISO 8601 timestamp.`,
    );
  }
  return dt;
}

function startOfWeek(d: Date): Date {
  // ISO week: Monday as start.
  const day = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(monday.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Convert anything → safe ISO date string for the response payload. */
export function isoOrUndefined(d: Date | undefined): string | undefined {
  return d?.toISOString();
}
