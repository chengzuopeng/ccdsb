const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})(.*)$/;

export function atStartOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function atEndOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function parseLocalDateOnly(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(y, month - 1, day);
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

export function isLocalDateOnly(s: string): boolean {
  return parseLocalDateOnly(s) !== null;
}

/** Parse a YYYY-MM-DD date or ISO-ish timestamp without accepting calendar
 *  overflow such as 2026-02-31. JavaScript's Date parser normalizes those
 *  to March, which is too surprising for usage filters and MCP tools. */
export function parseDateLike(
  s: string,
  opts: { upperBoundDateOnly?: boolean } = {},
): Date | null {
  const datePrefix = DATE_PREFIX_RE.exec(s);
  if (datePrefix) {
    const dateOnly = `${datePrefix[1]}-${datePrefix[2]}-${datePrefix[3]}`;
    const localDate = parseLocalDateOnly(dateOnly);
    if (!localDate) return null;
    if (datePrefix[4] === '') {
      return opts.upperBoundDateOnly ? atEndOfDay(localDate) : localDate;
    }
  }

  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
