import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { daySchema, sourceArgs, type SourceArg } from '../schema';
import { getMcpIndexerReady } from '../context';
import {
  modelEntries,
  projectEntries,
  sessionEntries,
  totalsForSource,
  totalsWithBySource,
  type FlatSessionEntry,
  type FlatProjectEntry,
  type FlatModelEntry,
} from '../formatters';
import type { AssistantRecord, ProviderId } from '@/lib/types';

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

/** Parse a "date" argument that accepts:
 *  - YYYY-MM-DD
 *  - 'today' / 'yesterday'
 *  - weekday name 'monday'..'sunday' → most recent occurrence (today included)
 *  Returns the [from, to] window covering that single calendar day. */
function parseDayArg(input: string | undefined): {
  from: Date;
  to: Date;
  label: string;
} {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayOf = (d: Date) => {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };
  if (!input || input.toLowerCase() === 'today') {
    const { start, end } = dayOf(today);
    return { from: start, to: end, label: 'today' };
  }
  const lower = input.toLowerCase();
  if (lower === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const { start, end } = dayOf(y);
    return { from: start, to: end, label: 'yesterday' };
  }
  const weekday = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = weekday.indexOf(lower);
  if (idx >= 0) {
    const target = new Date(today);
    let diff = target.getDay() - idx;
    if (diff < 0) diff += 7;
    target.setDate(target.getDate() - diff);
    const { start, end } = dayOf(target);
    return { from: start, to: end, label: lower };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const { start, end } = dayOf(dt);
    return { from: start, to: end, label: input };
  }
  // Schema-rejected inputs should never reach here. If they do (e.g. a
  // client bypassed validation), fail loudly rather than silently
  // returning all-time data.
  throw new Error(
    `invalid 'date' argument: ${JSON.stringify(input)}. Expected today | yesterday | monday..sunday | YYYY-MM-DD.`,
  );
}

/** ISO week start (Monday) for the given offset. 0=current week, -1=last, etc. */
function weekWindow(offset: number): { from: Date; to: Date; label: string } {
  const now = new Date();
  const day = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - day + 1 + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: monday, to: sunday, label: `${fmt(monday)} → ${fmt(sunday)}` };
}

/** Group sessions by project (cwd) for a daily/weekly summary view. */
function groupSessionsByProject(entries: FlatSessionEntry[]) {
  const map = new Map<string, { project: string; cwd: string; sessions: FlatSessionEntry[] }>();
  for (const s of entries) {
    const key = s.cwd || '(unknown)';
    let group = map.get(key);
    if (!group) {
      group = { project: s.project_name, cwd: key, sessions: [] };
      map.set(key, group);
    }
    group.sessions.push(s);
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      b.sessions.reduce((s, x) => s + x.cost_usd, 0) -
      a.sessions.reduce((s, x) => s + x.cost_usd, 0),
  );
}

function topToolUses(
  records: AssistantRecord[],
  windowed: { from: Date; to: Date },
  source: SourceArg,
  limit = 10,
) {
  const fromIso = windowed.from.toISOString();
  const toIso = windowed.to.toISOString();
  const counts = new Map<string, number>();
  for (const r of records) {
    if (source !== 'all' && r.source !== source) continue;
    if (r.timestamp < fromIso) continue;
    if (r.timestamp > toIso) continue;
    for (const t of r.toolNames) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tool, count]) => ({ tool, count }));
}

export function registerActivityTools(server: McpServer): void {
  // ── daily_summary ──
  server.registerTool(
    'daily_summary',
    {
      title: 'Daily summary — what was worked on',
      description:
        'A "what did I do" report for a single day. Returns totals, sessions grouped by project (with first-user-message titles), models used, and top tool calls. Date defaults to "today" and accepts "yesterday", weekday names ("monday"..), or YYYY-MM-DD.',
      inputSchema: {
        date: daySchema
          .optional()
          .describe('today | yesterday | monday..sunday | YYYY-MM-DD. Default today.'),
        ...sourceArgs,
      },
    },
    async (args) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const day = parseDayArg(args.date);
      const source = (args.source ?? 'all') as SourceArg;

      const totals = totalsWithBySource(snap.records, source, day);
      const sessions = sessionEntries(snap.records, snap.userRecords, source, day);
      const models = modelEntries(snap.records, source, day);
      const tools = topToolUses(snap.records, day, source);

      return asTextResult({
        date: day.label,
        from: day.from.toISOString(),
        to: day.to.toISOString(),
        source,
        totals: totals.totals,
        bySource: totals.bySource,
        session_count: sessions.length,
        sessions_by_project: groupSessionsByProject(sessions),
        models,
        top_tools: tools,
      });
    },
  );

  // ── weekly_summary ──
  server.registerTool(
    'weekly_summary',
    {
      title: 'Weekly summary',
      description:
        'A week-long roll-up: totals, per-day cost trend, top sessions by cost, top projects, and models used. Use `week_offset` to walk back (0=this week, -1=last week, etc.).',
      inputSchema: {
        week_offset: z
          .number()
          .int()
          .min(-52)
          .max(0)
          .default(0)
          .describe('0=this week, -1=last week, ..., -52=one year ago. Default 0.'),
        ...sourceArgs,
        top_session_limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async (args) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const offset = args.week_offset ?? 0;
      const week = weekWindow(offset);
      const source = (args.source ?? 'all') as SourceArg;

      const totals = totalsWithBySource(snap.records, source, week);

      // Per-day cost trend (7 entries)
      const days: Array<{ date: string; totals: ReturnType<typeof totalsForSource>; bySource: Record<ProviderId, ReturnType<typeof totalsForSource>> }> = [];
      for (let i = 0; i < 7; i++) {
        const dayStart = new Date(week.from);
        dayStart.setDate(dayStart.getDate() + i);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        const fmt = `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, '0')}-${String(dayStart.getDate()).padStart(2, '0')}`;
        const dayTotals = totalsWithBySource(snap.records, source, { from: dayStart, to: dayEnd });
        days.push({ date: fmt, totals: dayTotals.totals, bySource: dayTotals.bySource });
      }

      const allSessions = sessionEntries(snap.records, snap.userRecords, source, week);
      const topSessions = allSessions
        .slice()
        .sort((a, b) => b.cost_usd - a.cost_usd)
        .slice(0, args.top_session_limit ?? 10);

      const projects = projectEntries(snap.records, source, week).slice(0, 10);
      const models = modelEntries(snap.records, source, week);
      const tools = topToolUses(snap.records, week, source);

      return asTextResult({
        week: week.label,
        from: week.from.toISOString(),
        to: week.to.toISOString(),
        source,
        totals: totals.totals,
        bySource: totals.bySource,
        per_day: days,
        session_count: allSessions.length,
        top_sessions: topSessions,
        top_projects: projects,
        models,
        top_tools: tools,
      });
    },
  );

  // ── recent_activity ──
  server.registerTool(
    'recent_activity',
    {
      title: 'Recent activity',
      description:
        'The N most recently active sessions across providers. Quick way to answer "what did I just work on" without specifying a date.',
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe('Number of sessions to return. Default 10.'),
        ...sourceArgs,
      },
    },
    async (args) => {
      const idx = await getMcpIndexerReady();
      const snap = idx.getSnapshot();
      const source = (args.source ?? 'all') as SourceArg;
      const limit = args.limit ?? 10;

      const sessions = sessionEntries(snap.records, snap.userRecords, source, {})
        .slice()
        .sort((a, b) => b.end_time.localeCompare(a.end_time))
        .slice(0, limit);

      return asTextResult({
        source,
        returned_count: sessions.length,
        sessions,
      });
    },
  );
}

// Re-export types for convenience (avoid unused import warnings).
export type { FlatSessionEntry, FlatProjectEntry, FlatModelEntry, AssistantRecord, ProviderId };
