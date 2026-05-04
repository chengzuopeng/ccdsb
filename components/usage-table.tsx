'use client';

import { useMemo, useState } from 'react';
import {
  formatUSDPrecise,
  formatRelative,
  formatDateTime,
  formatTokensCompact,
  shortHash,
  shortenModel,
  projectNameFromCwd,
  cn,
} from '@/lib/utils';
import type { UsageTableRow, UsageTurnRow } from '@/lib/serialize';
import { useT } from '@/lib/i18n/context';

const PAGE_SIZE = 25;

type SortKey =
  | 'timestamp'
  | 'cost'
  | 'inputTokens'
  | 'outputTokens'
  | 'cacheReadTokens'
  | 'cacheCreationTokens'
  | 'callCount';

export function UsageTable({ rows }: { rows: UsageTurnRow[] }) {
  const t = useT();
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

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
      'cost',
      'tools',
    ];
    const lines = [headers.join(',')];
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

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder={t('common.searchPlaceholder')}
          className="px-3 py-1.5 text-sm rounded-button border border-border bg-bg-surface focus:outline-none focus:border-border-hi w-72 placeholder:text-text-tertiary text-text-primary"
        />
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary tabular-nums">
            {t('common.rows', { count: sorted.length.toLocaleString() })}
          </span>
          <button onClick={exportCsv} className="btn">
            {t('common.exportCsv')}
          </button>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-surface-hi/30">
                <Th><span className="sr-only">expand</span></Th>
                <Th sorted={sortKey === 'timestamp'} dir={sortDir} onClick={() => toggleSort('timestamp')}>
                  {t('usage.col.time')}
                </Th>
                <Th>{t('usage.col.userMessage')}</Th>
                <Th>{t('usage.col.model')}</Th>
                <Th>{t('usage.col.project')}</Th>
                <Th>{t('usage.col.session')}</Th>
                <Th
                  align="right"
                  sorted={sortKey === 'callCount'}
                  dir={sortDir}
                  onClick={() => toggleSort('callCount')}
                >
                  {t('usage.col.calls')}
                </Th>
                <Th
                  align="right"
                  sorted={sortKey === 'inputTokens'}
                  dir={sortDir}
                  onClick={() => toggleSort('inputTokens')}
                >
                  {t('usage.col.input')}
                </Th>
                <Th
                  align="right"
                  sorted={sortKey === 'outputTokens'}
                  dir={sortDir}
                  onClick={() => toggleSort('outputTokens')}
                >
                  {t('usage.col.output')}
                </Th>
                <Th
                  align="right"
                  sorted={sortKey === 'cacheReadTokens'}
                  dir={sortDir}
                  onClick={() => toggleSort('cacheReadTokens')}
                >
                  {t('usage.col.cacheRead')}
                </Th>
                <Th
                  align="right"
                  sorted={sortKey === 'cacheCreationTokens'}
                  dir={sortDir}
                  onClick={() => toggleSort('cacheCreationTokens')}
                >
                  {t('usage.col.cacheWrite')}
                </Th>
                <Th align="right" sorted={sortKey === 'cost'} dir={sortDir} onClick={() => toggleSort('cost')}>
                  {t('usage.col.cost')}
                </Th>
                <Th>{t('usage.col.tools')}</Th>
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
                  />
                );
              })}
              {slice.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-text-tertiary text-sm">
                    {t('common.noMatchingRows')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

function RowsForTurn({
  turn,
  isOpen,
  onToggle,
  userText,
  expandLabel,
  collapseLabel,
}: {
  turn: UsageTurnRow;
  isOpen: boolean;
  onToggle: () => void;
  userText: string;
  expandLabel: string;
  collapseLabel: string;
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
        <td
          className="px-3 py-2 num-mono text-text-secondary whitespace-nowrap"
          title={formatDateTime(turn.endTimestamp)}
        >
          {formatRelative(turn.endTimestamp)}
        </td>
        <td className="px-3 py-2 text-text-secondary truncate max-w-[280px]" title={userText}>
          {userText}
        </td>
        <td className="px-3 py-2 text-text-primary whitespace-nowrap">{modelLabel}</td>
        <td className="px-3 py-2 text-text-secondary truncate max-w-[160px]" title={turn.cwd}>
          {projectNameFromCwd(turn.cwd)}
        </td>
        <td className="px-3 py-2 num-mono text-text-tertiary text-xs" title={turn.sessionId}>
          {shortHash(turn.sessionId)}
        </td>
        <td className="px-3 py-2 num-mono text-right text-text-secondary">{turn.callCount}</td>
        <td className="px-3 py-2 num-mono text-right text-text-secondary">
          {formatTokensCompact(turn.inputTokens)}
        </td>
        <td className="px-3 py-2 num-mono text-right text-text-secondary">
          {formatTokensCompact(turn.outputTokens)}
        </td>
        <td className="px-3 py-2 num-mono text-right text-success">
          {formatTokensCompact(turn.cacheReadTokens)}
        </td>
        <td className="px-3 py-2 num-mono text-right text-text-secondary">
          {formatTokensCompact(turn.cacheCreationTokens)}
        </td>
        <td className="px-3 py-2 num-mono text-right text-text-primary font-medium">
          {formatUSDPrecise(turn.cost)}
        </td>
        <td className="px-3 py-2 text-xs text-text-tertiary truncate max-w-[160px]" title={turn.toolNames.join(', ')}>
          {toolsLabel}
        </td>
      </tr>
      {isOpen &&
        turn.children.map((r) => (
          <tr
            key={r.uuid}
            className="border-b border-border last:border-b-0 bg-bg-surface-hi/20 text-text-tertiary"
          >
            <td className="px-2 py-1.5 w-6"></td>
            <td
              className="px-3 py-1.5 num-mono whitespace-nowrap pl-8"
              title={formatDateTime(r.timestamp)}
            >
              {formatRelative(r.timestamp)}
            </td>
            <td className="px-3 py-1.5 text-text-tertiary text-xs">—</td>
            <td className="px-3 py-1.5 whitespace-nowrap">{shortenModel(r.model)}</td>
            <td className="px-3 py-1.5 truncate max-w-[160px]" title={r.cwd}>
              {projectNameFromCwd(r.cwd)}
            </td>
            <td className="px-3 py-1.5 num-mono text-xs" title={r.sessionId}>
              {shortHash(r.sessionId)}
            </td>
            <td className="px-3 py-1.5 num-mono text-right">1</td>
            <td className="px-3 py-1.5 num-mono text-right">
              {formatTokensCompact(r.inputTokens)}
            </td>
            <td className="px-3 py-1.5 num-mono text-right">
              {formatTokensCompact(r.outputTokens)}
            </td>
            <td className="px-3 py-1.5 num-mono text-right text-success">
              {formatTokensCompact(r.cacheReadTokens)}
            </td>
            <td className="px-3 py-1.5 num-mono text-right">
              {formatTokensCompact(r.cacheCreationTokens)}
            </td>
            <td className="px-3 py-1.5 num-mono text-right">{formatUSDPrecise(r.cost)}</td>
            <td
              className="px-3 py-1.5 text-xs truncate max-w-[160px]"
              title={r.toolNames.join(', ')}
            >
              {r.toolNames.length ? r.toolNames.join(', ') : '—'}
            </td>
          </tr>
        ))}
    </>
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
