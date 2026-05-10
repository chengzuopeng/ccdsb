export const USAGE_RANGES = ['1d', '7d', '30d', '90d', 'all'] as const;
export type UsageRange = (typeof USAGE_RANGES)[number];

export function isUsageRange(v: unknown): v is UsageRange {
  return typeof v === 'string' && (USAGE_RANGES as readonly string[]).includes(v);
}

export function normalizeUsageRange(
  raw: string | null | undefined,
  fallback: UsageRange = '7d',
): UsageRange {
  return isUsageRange(raw) ? raw : fallback;
}

export function rangeToDates(range: UsageRange): { from?: Date; to?: Date } {
  const now = new Date();
  if (range === 'all') return {};
  if (range === '1d') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from };
  }
  const m = range.match(/^(\d+)([dwm])$/);
  if (!m) return {};
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const from = new Date(now);
  if (unit === 'd') from.setDate(from.getDate() - n);
  else if (unit === 'w') from.setDate(from.getDate() - n * 7);
  else if (unit === 'm') from.setMonth(from.getMonth() - n);
  return { from };
}
