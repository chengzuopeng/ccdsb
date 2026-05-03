export function rangeToDates(range: string): { from?: Date; to?: Date } {
  const now = new Date();
  if (!range || range === 'all') return {};
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
