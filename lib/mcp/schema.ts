import { z } from 'zod';
import type { ProviderId } from '@/lib/types';
import { isLocalDateOnly, parseDateLike } from '@/lib/date-utils';

/** Source filter for any analytical tool. `all` is the default — when used,
 *  the tool returns combined totals AND a per-source breakdown so the LLM
 *  can drill into either provider. */
export const sourceSchema = z.enum(['claude', 'codex', 'all']).default('all');
export type SourceArg = z.infer<typeof sourceSchema>;

/** Time-window granularity for `usage_by_time`. */
export const granularitySchema = z.enum(['hour', 'day', 'week', 'month']).default('day');
export type GranularityArg = z.infer<typeof granularitySchema>;

/** Predicate: a string parses as either YYYY-MM-DD or a full ISO 8601
 *  timestamp. Anything else (e.g. 'yesterday', 'abc') is rejected so the
 *  caller can't accidentally collapse the window to all-time without
 *  knowing it. */
function isValidDateString(s: string): boolean {
  return parseDateLike(s) !== null;
}

const dateBoundSchema = z
  .string()
  .refine(isValidDateString, {
    message: 'must be a YYYY-MM-DD date or a full ISO 8601 timestamp',
  });

/** Date-range argument shared across most tools.
 *
 *  Either pass a named `range` ("today", "yesterday", "this_week",
 *  "this_month", "last_week", "last_month", "7d", "30d", "90d", "all"),
 *  or pass explicit `from` / `to` (inclusive, ISO 8601 date or full
 *  timestamp). Combining is OK — explicit values override the named range.
 *
 *  Invalid `range` values are rejected at parse time by zod's enum check;
 *  invalid `from`/`to` strings are rejected by the refinement above. The
 *  goal is to surface a clear MCP error instead of silently falling back
 *  to all-time data, which would mislead the LLM. */
export const rangeArgsSchema = {
  range: z
    .enum([
      'today',
      'yesterday',
      'this_week',
      'last_week',
      'this_month',
      'last_month',
      '7d',
      '30d',
      '90d',
      'all',
    ])
    .optional()
    .describe('Named time window. Defaults to "all" if no explicit from/to is given.'),
  from: dateBoundSchema
    .optional()
    .describe('Inclusive lower bound (ISO date YYYY-MM-DD or full ISO timestamp).'),
  to: dateBoundSchema
    .optional()
    .describe('Inclusive upper bound (ISO date YYYY-MM-DD or full ISO timestamp).'),
};

/** Schema for `daily_summary`'s `date` arg. Accepts:
 *  - `today` | `yesterday`
 *  - lowercase weekday names: `monday` ... `sunday`
 *  - explicit `YYYY-MM-DD`
 *  Anything else is rejected with a clear message. */
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const SPECIAL_DAYS = ['today', 'yesterday'] as const;
export const daySchema = z
  .string()
  .refine(
    (s) => {
      const lower = s.toLowerCase();
      if ((SPECIAL_DAYS as readonly string[]).includes(lower)) return true;
      if ((WEEKDAYS as readonly string[]).includes(lower)) return true;
      return isLocalDateOnly(s);
    },
    {
      message: 'must be "today", "yesterday", a weekday name (monday..sunday), or YYYY-MM-DD',
    },
  );

export const sourceArgs = {
  source: sourceSchema.describe(
    'claude | codex | all (default). When all, the response carries combined totals plus a bySource breakdown.',
  ),
};

export const PROVIDERS: ProviderId[] = ['claude', 'codex'];
