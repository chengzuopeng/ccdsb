import { getCachedScan } from '@/lib/data-loader/scan';
import { recordsToTurnRows } from '@/lib/serialize';
import { rangeToDates } from '@/lib/range';
import { resolveSource, filterBySource } from '@/lib/source';
import type { UsageTurnRow } from '@/lib/serialize';
import { isSortKey, type SortKey } from '@/lib/usage-query';
import { withApiErrorHandling } from '@/lib/api/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * RFC 4180 escape + Excel formula-injection guard. If a cell starts with
 * `=`, `+`, `-`, or `@`, spreadsheet apps may parse it as a formula. We
 * prefix a single quote to neutralize it. Numbers are stringified by callers.
 */
function csvEscape(raw: unknown): string {
  let s = String(raw ?? '');
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function filterTurnsByQuery(turns: UsageTurnRow[], q: string): UsageTurnRow[] {
  if (!q) return turns;
  const needle = q.toLowerCase();
  return turns.filter(
    (t) =>
      t.userText.toLowerCase().includes(needle) ||
      t.cwd.toLowerCase().includes(needle) ||
      t.sessionId.toLowerCase().includes(needle) ||
      t.models.some((m) => m.toLowerCase().includes(needle)) ||
      t.toolNames.some((tool) => tool.toLowerCase().includes(needle)),
  );
}

function sortTurns(turns: UsageTurnRow[], key: SortKey, dir: 'asc' | 'desc'): UsageTurnRow[] {
  const arr = turns.slice();
  arr.sort((a, b) => {
    const av = key === 'timestamp' ? a.endTimestamp : (a[key] as number);
    const bv = key === 'timestamp' ? b.endTimestamp : (b[key] as number);
    if (av === bv) return 0;
    return (dir === 'asc' ? 1 : -1) * (av < bv ? -1 : 1);
  });
  return arr;
}

export const GET = withApiErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const source = await resolveSource(url.searchParams.get('source'));
  const range = url.searchParams.get('range') || 'all';
  const models = url.searchParams.get('models')?.split(',').filter(Boolean) ?? [];
  const projects = url.searchParams.get('projects')?.split(',').filter(Boolean) ?? [];
  const query = (url.searchParams.get('q') || '').trim();
  const sortRaw = url.searchParams.get('sort');
  const sortKey: SortKey = sortRaw && isSortKey(sortRaw) ? sortRaw : 'timestamp';
  const sortDir: 'asc' | 'desc' = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';

  const scan = await getCachedScan();
  const sourceRecords = filterBySource(scan.records, source);
  const sourceUsers = filterBySource(scan.userRecords, source);
  const dates = rangeToDates(range);

  const filteredRecords = sourceRecords.filter((r) => {
    if (dates.from && r.timestamp < dates.from.toISOString()) return false;
    if (dates.to && r.timestamp > dates.to.toISOString()) return false;
    if (models.length && !models.includes(r.model)) return false;
    if (projects.length && !projects.includes(r.cwd)) return false;
    return true;
  });

  const allTurns = recordsToTurnRows(filteredRecords, sourceUsers, scan.parentMap);
  const searched = filterTurnsByQuery(allTurns, query);
  const sorted = sortTurns(searched, sortKey, sortDir);

  const headers = [
    'turn_id',
    'timestamp',
    'model',
    'project',
    'session',
    'input',
    'output',
    'cache_read',
    'cache_create',
    'total_tokens',
    'cost',
    'tools',
  ];

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const push = (line: string) => controller.enqueue(enc.encode(line + '\n'));

      try {
        push(`# generated_at=${new Date().toISOString()}`);
        push(`# source=${source}`);
        push(`# range=${range}`);
        if (models.length) push(`# models=${models.join(';')}`);
        if (projects.length) push(`# projects=${projects.map((p) => p.replace(/[,;]/g, ' ')).join(';')}`);
        if (query) push(`# search=${query.replace(/[,\n\r]/g, ' ')}`);
        push(`# turns=${sorted.length}`);
        const totalRows = sorted.reduce((s, t) => s + t.callCount, 0);
        push(`# rows=${totalRows}`);
        push(headers.join(','));

        for (const turn of sorted) {
          for (const r of turn.children) {
            push(
              [
                csvEscape(turn.turnId),
                csvEscape(r.timestamp),
                csvEscape(r.model),
                csvEscape(r.cwd),
                csvEscape(r.sessionId),
                r.inputTokens,
                r.outputTokens,
                r.cacheReadTokens,
                r.cacheCreationTokens,
                r.totalTokens,
                r.cost.toFixed(6),
                csvEscape(r.toolNames.join(';')),
              ].join(','),
            );
          }
        }

        controller.close();
      } catch (err) {
        // Mid-stream errors can't switch to a JSON 500 (headers are already
        // sent), but we surface a comment line + abort so the user sees
        // why the file is truncated and the server gets a logged stack.
        const msg = (err as Error).message || 'export error';
        console.error('[ccgauge:api] /api/export/usage stream failed', (err as Error).stack || msg);
        try {
          push(`# error: export aborted: ${msg.replace(/[\n\r,]/g, ' ')}`);
        } catch {
          // ignore double-fault
        }
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ccgauge-usage-${source}-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
