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
 *  overflow such as `2026-02-31`. JavaScript's Date parser silently
 *  normalises those to March, which is too surprising for usage filters
 *  and MCP tools — an LLM that asks for February data should NOT receive
 *  March data just because it typo'd the day.
 *
 *  The validation is two-stage so a trailing time/zone suffix
 *  (`2026-02-31T00:00:00`) doesn't bypass it:
 *  1. The leading `YYYY-MM-DD` always goes through `parseLocalDateOnly`,
 *     which rejects calendar overflow.
 *  2. After parsing the full string, we round-trip the resulting Date
 *     back to a Y-M-D and assert it matches the input digits. */
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

    // Has a time suffix. Let JS parse the full string, then round-trip
    // the result back through the same digits to catch silent
    // normalisation. We compare via UTC date components because an ISO
    // timestamp with a `Z` or explicit offset is interpreted at that
    // offset by the parser, so the calendar day-of-month in UTC is what
    // the user actually typed.
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return null;
    const y = Number(datePrefix[1]);
    const m = Number(datePrefix[2]);
    const d = Number(datePrefix[3]);
    const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
    const yy = hasZone ? dt.getUTCFullYear() : dt.getFullYear();
    const mm = (hasZone ? dt.getUTCMonth() : dt.getMonth()) + 1;
    const dd = hasZone ? dt.getUTCDate() : dt.getDate();
    if (yy !== y || mm !== m || dd !== d) return null;
    return dt;
  }

  // No YYYY-MM-DD prefix: accept anything Date can parse (e.g. RFC 2822).
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt;
}
