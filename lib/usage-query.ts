export const USAGE_PAGE_SIZE = 25;

export const SORT_KEYS = [
  'timestamp',
  'cost',
  'inputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheCreationTokens',
  'totalTokens',
  'callCount',
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export function isSortKey(v: unknown): v is SortKey {
  return typeof v === 'string' && (SORT_KEYS as readonly string[]).includes(v);
}

export function parseUsagePageParam(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.floor(n) - 1;
}
