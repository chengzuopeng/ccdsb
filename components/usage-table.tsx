'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  formatUSDPrecise,
  formatDateTime,
  formatTokensCompact,
  shortHash,
  shortenModel,
  projectNameFromCwd,
  cn,
} from '@/lib/utils';
import type { UsageTableRow, UsageTurnRow } from '@/lib/serialize';
import { useT, useI18n } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/dict';
import { HoverCard } from '@/components/hover-card';
import { ScrollShadows } from '@/components/scroll-shadows';

const PAGE_SIZE = 25;

type SortKey =
  | 'timestamp'
  | 'cost'
  | 'inputTokens'
  | 'outputTokens'
  | 'cacheReadTokens'
  | 'cacheCreationTokens'
  | 'totalTokens'
  | 'callCount';

type ColumnId =
  | 'time'
  | 'prompt'
  | 'model'
  | 'project'
  | 'session'
  | 'calls'
  | 'input'
  | 'output'
  | 'cacheRead'
  | 'cacheWrite'
  | 'total'
  | 'cost'
  | 'tools';

interface ColumnDef {
  id: ColumnId;
  labelKey: string;
  align?: 'left' | 'right';
  sortKey?: SortKey;
  defaultVisible: boolean;
}

const COLUMNS: ColumnDef[] = [
  { id: 'time', labelKey: 'usage.col.time', sortKey: 'timestamp', defaultVisible: true },
  { id: 'prompt', labelKey: 'usage.col.userMessage', defaultVisible: true },
  { id: 'model', labelKey: 'usage.col.model', defaultVisible: true },
  { id: 'project', labelKey: 'usage.col.project', defaultVisible: true },
  { id: 'session', labelKey: 'usage.col.session', defaultVisible: false },
  { id: 'calls', labelKey: 'usage.col.calls', align: 'right', sortKey: 'callCount', defaultVisible: false },
  { id: 'input', labelKey: 'usage.col.input', align: 'right', sortKey: 'inputTokens', defaultVisible: false },
  { id: 'output', labelKey: 'usage.col.output', align: 'right', sortKey: 'outputTokens', defaultVisible: false },
  { id: 'cacheRead', labelKey: 'usage.col.cacheRead', align: 'right', sortKey: 'cacheReadTokens', defaultVisible: false },
  { id: 'cacheWrite', labelKey: 'usage.col.cacheWrite', align: 'right', sortKey: 'cacheCreationTokens', defaultVisible: false },
  { id: 'total', labelKey: 'usage.col.total', align: 'right', sortKey: 'totalTokens', defaultVisible: true },
  { id: 'cost', labelKey: 'usage.col.cost', align: 'right', sortKey: 'cost', defaultVisible: false },
  { id: 'tools', labelKey: 'usage.col.tools', defaultVisible: false },
];

const STORAGE_KEY = 'ccgauge.usage.cols.v2';

function defaultVisible(): Record<ColumnId, boolean> {
  return COLUMNS.reduce(
    (acc, c) => {
      acc[c.id] = c.defaultVisible;
      return acc;
    },
    {} as Record<ColumnId, boolean>,
  );
}

function loadVisible(): Record<ColumnId, boolean> {
  if (typeof window === 'undefined') return defaultVisible();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultVisible();
    const parsed = JSON.parse(raw) as Partial<Record<ColumnId, boolean>>;
    const base = defaultVisible();
    for (const c of COLUMNS) {
      if (typeof parsed[c.id] === 'boolean') base[c.id] = parsed[c.id]!;
    }
    return base;
  } catch {
    return defaultVisible();
  }
}

export interface UsageTableMeta {
  range?: string;
  granularity?: string;
  models?: string[];
  projects?: string[];
}

const VALID_SORT_KEYS: SortKey[] = [
  'timestamp',
  'cost',
  'inputTokens',
  'outputTokens',
  'cacheReadTokens',
  'cacheCreationTokens',
  'totalTokens',
  'callCount',
];

export function UsageTable({ rows, meta }: { rows: UsageTurnRow[]; meta?: UsageTableMeta }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const urlSort = params.get('sort');
  const urlDir = params.get('dir');
  const urlPage = Number(params.get('page') || '1');
  const urlQuery = params.get('q') || '';

  const initialSortKey: SortKey =
    urlSort && (VALID_SORT_KEYS as string[]).includes(urlSort) ? (urlSort as SortKey) : 'timestamp';
  const initialSortDir: 'asc' | 'desc' = urlDir === 'asc' ? 'asc' : 'desc';
  const initialPage = Number.isFinite(urlPage) && urlPage > 0 ? urlPage - 1 : 0;

  const [page, setPageState] = useState(initialPage);
  const [sortKey, setSortKeyState] = useState<SortKey>(initialSortKey);
  const [sortDir, setSortDirState] = useState<'asc' | 'desc'>(initialSortDir);
  const [query, setQueryState] = useState(urlQuery);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<Record<ColumnId, boolean>>(defaultVisible);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  const writeUrl = (
    next: { sort?: SortKey; dir?: 'asc' | 'desc'; page?: number; q?: string },
    replace = false,
  ) => {
    const sp = new URLSearchParams(params.toString());
    const apply = (k: string, v: string | undefined, def?: string) => {
      if (v === undefined) return;
      if (!v || v === def) sp.delete(k);
      else sp.set(k, v);
    };
    if (next.sort !== undefined) apply('sort', next.sort, 'timestamp');
    if (next.dir !== undefined) apply('dir', next.dir, 'desc');
    if (next.page !== undefined) apply('page', next.page > 0 ? String(next.page + 1) : '', '');
    if (next.q !== undefined) apply('q', next.q.trim(), '');
    const qs = sp.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (replace) router.replace(url);
    else router.replace(url);
  };

  function setPage(n: number) {
    setPageState(n);
    writeUrl({ page: n });
  }

  function applySort(key: SortKey) {
    let nextKey = key;
    let nextDir: 'asc' | 'desc' = 'desc';
    if (sortKey === key) {
      nextKey = key;
      nextDir = sortDir === 'asc' ? 'desc' : 'asc';
    }
    setSortKeyState(nextKey);
    setSortDirState(nextDir);
    setPageState(0);
    writeUrl({ sort: nextKey, dir: nextDir, page: 0 });
  }

  // Debounce query → URL
  const queryTimer = useRef<number | null>(null);
  function setQuery(q: string) {
    setQueryState(q);
    setPageState(0);
    if (queryTimer.current) window.clearTimeout(queryTimer.current);
    queryTimer.current = window.setTimeout(() => {
      writeUrl({ q, page: 0 });
    }, 250);
  }

  useEffect(() => {
    setVisible(loadVisible());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
    }
  }, [visible]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const activeColumns = COLUMNS.filter((c) => visible[c.id]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        r.models.some((m) => m.toLowerCase().includes(q)) ||
        r.cwd.toLowerCase().includes(q) ||
        r.sessionId.toLowerCase().includes(q) ||
        r.toolNames.some((tool) => tool.toLowerCase().includes(q)) ||
        r.userText.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = sortKey === 'timestamp' ? a.endTimestamp : (a[sortKey] as number);
      const bv = sortKey === 'timestamp' ? b.endTimestamp : (b[sortKey] as number);
      if (av === bv) return 0;
      if (sortDir === 'asc') return av < bv ? -1 : 1;
      return av < bv ? 1 : -1;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggleSort = applySort;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
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
    const lines: string[] = [];
    lines.push(`# generated_at=${new Date().toISOString()}`);
    if (meta?.range) lines.push(`# range=${meta.range}`);
    if (meta?.granularity) lines.push(`# granularity=${meta.granularity}`);
    if (meta?.models?.length) lines.push(`# models=${meta.models.join(';')}`);
    if (meta?.projects?.length) lines.push(`# projects=${meta.projects.map((p) => p.replace(/[,;]/g, ' ')).join(';')}`);
    if (query.trim()) lines.push(`# search=${query.trim()}`);
    lines.push(`# turns=${sorted.length}`);
    lines.push(`# rows=${sorted.reduce((s, t) => s + t.callCount, 0)}`);
    lines.push(headers.join(','));
    for (const turn of sorted) {
      for (const r of turn.children) {
        lines.push(
          [
            turn.turnId,
            r.timestamp,
            r.model,
            csvEscape(r.cwd),
            r.sessionId,
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
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ccgauge-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const colSpan = activeColumns.length + 1;
  const visibleCount = activeColumns.length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder={t('common.searchPlaceholder')}
          className="px-3 py-1.5 text-sm rounded-button border border-border bg-bg-surface focus:outline-none focus:border-border-hi w-72 placeholder:text-text-tertiary text-text-primary"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary tabular-nums">
            {t('common.rows', { count: sorted.length.toLocaleString() })}
          </span>
          <div ref={colsRef} className="relative">
            <button onClick={() => setColsOpen((o) => !o)} className="btn">
              {t('usage.columns.button')}
              <span className="ml-1 text-text-tertiary tabular-nums">{visibleCount}</span>
            </button>
            {colsOpen && (
              <div className="absolute right-0 mt-1 w-56 card border-border-hi shadow-lg p-2 z-30">
                <div className="flex items-center justify-between px-1.5 pb-1.5 mb-1 border-b border-border">
                  <span className="text-xs text-text-tertiary uppercase tracking-wide">
                    {t('usage.columns.title')}
                  </span>
                  <button
                    onClick={() => setVisible(defaultVisible())}
                    className="text-xs text-text-tertiary hover:text-text-primary"
                  >
                    {t('usage.columns.reset')}
                  </button>
                </div>
                <div className="max-h-72 overflow-auto">
                  {COLUMNS.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 px-1.5 py-1.5 text-sm rounded hover:bg-bg-surface-hi cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!!visible[c.id]}
                        onChange={(e) =>
                          setVisible((prev) => ({ ...prev, [c.id]: e.target.checked }))
                        }
                        className="accent-brand"
                      />
                      <span className="text-text-secondary">{t(c.labelKey)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={exportCsv} className="btn">
            {t('common.exportCsv')}
          </button>
        </div>
      </div>
      <div className="card overflow-hidden">
        <ScrollShadows>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-surface-hi/30">
                <Th>
                  <span className="sr-only">expand</span>
                </Th>
                {activeColumns.map((c) => (
                  <Th
                    key={c.id}
                    align={c.align}
                    sorted={c.sortKey ? sortKey === c.sortKey : false}
                    dir={sortDir}
                    onClick={c.sortKey ? () => toggleSort(c.sortKey!) : undefined}
                  >
                    {t(c.labelKey)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((turn) => {
                const isOpen = expanded.has(turn.turnId);
                const userText = turn.userText.trim() || t('usage.turn.noPrompt');
                return (
                  <RowsForTurn
                    key={turn.turnId}
                    turn={turn}
                    isOpen={isOpen}
                    onToggle={() => toggleExpand(turn.turnId)}
                    userText={userText}
                    expandLabel={t('usage.turn.expand')}
                    collapseLabel={t('usage.turn.collapse')}
                    activeColumns={activeColumns}
                    locale={locale}
                    t={t}
                  />
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-text-tertiary text-sm">
                    {t('common.noMatchingRows')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollShadows>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-text-secondary">
          <span>{t('common.pageOf', { page: safePage + 1, total: pageCount })}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(0)} disabled={safePage === 0} className="btn-ghost disabled:opacity-40">
              {t('common.first')}
            </button>
            <button
              onClick={() => setPage(safePage - 1)}
              disabled={safePage === 0}
              className="btn-ghost disabled:opacity-40"
            >
              {t('common.prev')}
            </button>
            <button
              onClick={() => setPage(safePage + 1)}
              disabled={safePage >= pageCount - 1}
              className="btn-ghost disabled:opacity-40"
            >
              {t('common.next')}
            </button>
            <button
              onClick={() => setPage(pageCount - 1)}
              disabled={safePage >= pageCount - 1}
              className="btn-ghost disabled:opacity-40"
            >
              {t('common.last')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function RowsForTurn({
  turn,
  isOpen,
  onToggle,
  userText,
  expandLabel,
  collapseLabel,
  activeColumns,
  locale,
  t,
}: {
  turn: UsageTurnRow;
  isOpen: boolean;
  onToggle: () => void;
  userText: string;
  expandLabel: string;
  collapseLabel: string;
  activeColumns: ColumnDef[];
  locale: Locale;
  t: Translator;
}) {
  const modelLabel =
    turn.models.length === 1
      ? shortenModel(turn.models[0])
      : `${shortenModel(turn.models[0])} +${turn.models.length - 1}`;
  const toolsLabel = turn.toolNames.length
    ? turn.toolNames.slice(0, 3).join(', ') + (turn.toolNames.length > 3 ? '…' : '')
    : '—';

  return (
    <>
      <tr
        className="border-b border-border last:border-b-0 hover:bg-bg-surface-hi/40 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-2 py-2 text-text-tertiary w-6 text-center select-none">
          <span title={isOpen ? collapseLabel : expandLabel} className="inline-block w-4">
            {isOpen ? '▾' : '▸'}
          </span>
        </td>
        {activeColumns.map((c) => (
          <td
            key={c.id}
            className={cn('px-3 py-2', c.align === 'right' ? 'text-right' : 'text-left')}
          >
            {renderTurnCell(c.id, turn, modelLabel, toolsLabel, userText, locale, t)}
          </td>
        ))}
      </tr>
      {isOpen &&
        turn.children.map((r) => (
          <tr
            key={r.uuid}
            className="border-b border-border last:border-b-0 bg-bg-surface-hi/20 text-text-tertiary"
          >
            <td className="px-2 py-1.5 w-6"></td>
            {activeColumns.map((c) => (
              <td
                key={c.id}
                className={cn('px-3 py-1.5', c.align === 'right' ? 'text-right' : 'text-left')}
              >
                {renderChildCell(c.id, r, locale, t)}
              </td>
            ))}
          </tr>
        ))}
    </>
  );
}

function renderTurnCell(
  id: ColumnId,
  turn: UsageTurnRow,
  modelLabel: string,
  toolsLabel: string,
  userText: string,
  locale: Locale,
  t: Translator,
): React.ReactNode {
  switch (id) {
    case 'time':
      return (
        <span className="num-mono text-text-secondary whitespace-nowrap text-xs">
          {formatDateTime(turn.endTimestamp)}
        </span>
      );
    case 'prompt':
      return (
        <HoverCard
          maxWidth={460}
          panelClassName="p-3 text-sm text-text-secondary leading-relaxed"
          content={<div className="whitespace-pre-wrap break-words">{userText}</div>}
        >
          <span className="block text-text-secondary truncate max-w-[280px]">{userText}</span>
        </HoverCard>
      );
    case 'model':
      return <span className="text-text-primary whitespace-nowrap">{modelLabel}</span>;
    case 'project':
      return (
        <span className="block text-text-secondary truncate max-w-[160px]" title={turn.cwd}>
          {projectNameFromCwd(turn.cwd)}
        </span>
      );
    case 'session':
      return (
        <span className="num-mono text-text-tertiary text-xs" title={turn.sessionId}>
          {shortHash(turn.sessionId)}
        </span>
      );
    case 'calls':
      return <span className="num-mono text-text-secondary">{turn.callCount}</span>;
    case 'input':
      return (
        <span className="num-mono text-text-secondary">
          {formatTokensCompact(turn.inputTokens, locale)}
        </span>
      );
    case 'output':
      return (
        <span className="num-mono text-text-secondary">
          {formatTokensCompact(turn.outputTokens, locale)}
        </span>
      );
    case 'cacheRead':
      return (
        <span className="num-mono text-success">{formatTokensCompact(turn.cacheReadTokens, locale)}</span>
      );
    case 'cacheWrite':
      return (
        <span className="num-mono text-text-secondary">
          {formatTokensCompact(turn.cacheCreationTokens, locale)}
        </span>
      );
    case 'total':
      return (
        <HoverCard
          align="right"
          maxWidth={300}
          panelClassName="p-0 overflow-hidden"
          content={<TokenBreakdown row={turn} locale={locale} t={t} />}
        >
          <span className="num-mono text-text-primary font-medium border-b border-dashed border-border hover:border-text-tertiary cursor-help">
            {formatTokensCompact(turn.totalTokens, locale)}
          </span>
        </HoverCard>
      );
    case 'cost':
      return (
        <span className="num-mono text-text-primary font-medium">
          {formatUSDPrecise(turn.cost)}
        </span>
      );
    case 'tools':
      return (
        <span
          className="block text-xs text-text-tertiary truncate max-w-[160px]"
          title={turn.toolNames.join(', ')}
        >
          {toolsLabel}
        </span>
      );
  }
}

function renderChildCell(id: ColumnId, r: UsageTableRow, locale: Locale, t: Translator): React.ReactNode {
  switch (id) {
    case 'time':
      return (
        <span className="num-mono whitespace-nowrap pl-5 text-xs">
          {formatDateTime(r.timestamp)}
        </span>
      );
    case 'prompt':
      return <span className="text-xs">—</span>;
    case 'model':
      return <span className="whitespace-nowrap">{shortenModel(r.model)}</span>;
    case 'project':
      return (
        <span className="block truncate max-w-[160px]" title={r.cwd}>
          {projectNameFromCwd(r.cwd)}
        </span>
      );
    case 'session':
      return (
        <span className="num-mono text-xs" title={r.sessionId}>
          {shortHash(r.sessionId)}
        </span>
      );
    case 'calls':
      return <span className="num-mono">1</span>;
    case 'input':
      return <span className="num-mono">{formatTokensCompact(r.inputTokens, locale)}</span>;
    case 'output':
      return <span className="num-mono">{formatTokensCompact(r.outputTokens, locale)}</span>;
    case 'cacheRead':
      return (
        <span className="num-mono text-success">{formatTokensCompact(r.cacheReadTokens, locale)}</span>
      );
    case 'cacheWrite':
      return <span className="num-mono">{formatTokensCompact(r.cacheCreationTokens, locale)}</span>;
    case 'total':
      return (
        <HoverCard
          align="right"
          maxWidth={300}
          panelClassName="p-0 overflow-hidden"
          content={<TokenBreakdown row={r} locale={locale} t={t} />}
        >
          <span className="num-mono border-b border-dashed border-border/60 hover:border-text-tertiary cursor-help">
            {formatTokensCompact(r.totalTokens, locale)}
          </span>
        </HoverCard>
      );
    case 'cost':
      return <span className="num-mono">{formatUSDPrecise(r.cost)}</span>;
    case 'tools':
      return (
        <span className="block text-xs truncate max-w-[160px]" title={r.toolNames.join(', ')}>
          {r.toolNames.length ? r.toolNames.join(', ') : '—'}
        </span>
      );
  }
}

type BreakdownInput = Pick<
  UsageTableRow & UsageTurnRow,
  | 'inputTokens'
  | 'outputTokens'
  | 'cacheReadTokens'
  | 'cacheCreationTokens'
  | 'totalTokens'
  | 'cost'
  | 'costInput'
  | 'costOutput'
  | 'costCacheRead'
  | 'costCacheWrite'
>;

function TokenBreakdown({
  row,
  locale,
  t,
}: {
  row: BreakdownInput;
  locale: Locale;
  t: Translator;
}) {
  const items: Array<{ key: string; label: string; tokens: number; cost: number; tone: string; dot: string }> = [
    {
      key: 'input',
      label: t('usage.col.input'),
      tokens: row.inputTokens,
      cost: row.costInput,
      tone: 'text-text-primary',
      dot: 'bg-chart-input',
    },
    {
      key: 'output',
      label: t('usage.col.output'),
      tokens: row.outputTokens,
      cost: row.costOutput,
      tone: 'text-text-primary',
      dot: 'bg-chart-output',
    },
    {
      key: 'cacheRead',
      label: t('usage.col.cacheRead'),
      tokens: row.cacheReadTokens,
      cost: row.costCacheRead,
      tone: 'text-success',
      dot: 'bg-chart-cache-read',
    },
    {
      key: 'cacheWrite',
      label: t('usage.col.cacheWrite'),
      tokens: row.cacheCreationTokens,
      cost: row.costCacheWrite,
      tone: 'text-text-primary',
      dot: 'bg-chart-cache-create',
    },
  ];
  return (
    <div className="text-xs">
      <div className="px-3 py-2 border-b border-border bg-bg-surface-hi/40 text-text-tertiary uppercase tracking-wide font-medium">
        {t('usage.breakdown.title')}
      </div>
      <div className="px-3 py-2">
        <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 items-center">
          <span />
          <span className="text-text-tertiary text-[10px] uppercase tracking-wide text-right">
            {t('usage.breakdown.headerTokens')}
          </span>
          <span className="text-text-tertiary text-[10px] uppercase tracking-wide text-right">
            {t('usage.breakdown.headerCost')}
          </span>
          {items.map((it) => (
            <Fragment key={it.key}>
              <span className="inline-flex items-center gap-1.5 text-text-secondary">
                <span className={cn('w-2 h-2 rounded-sm shrink-0', it.dot)} />
                {it.label}
              </span>
              <span className={cn('num-mono text-right', it.tone)}>
                {formatTokensCompact(it.tokens, locale)}
              </span>
              <span className="num-mono text-right text-text-secondary">
                {it.cost > 0 ? formatUSDPrecise(it.cost) : '—'}
              </span>
            </Fragment>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-border grid grid-cols-[auto_1fr_auto] gap-x-3 items-center">
          <span className="text-text-secondary font-medium">{t('usage.breakdown.total')}</span>
          <span className="num-mono text-right text-text-primary font-medium">
            {formatTokensCompact(row.totalTokens, locale)}
          </span>
          <span className="num-mono text-right text-text-primary font-medium">
            {formatUSDPrecise(row.cost)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
  sorted,
  dir,
  onClick,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  sorted?: boolean;
  dir?: 'asc' | 'desc';
  onClick?: () => void;
}) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        onClick && 'cursor-pointer hover:text-text-primary select-none',
      )}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sorted && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
