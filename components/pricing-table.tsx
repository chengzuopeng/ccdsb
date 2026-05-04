'use client';

import { useMemo, useState } from 'react';
import { cn, formatUSD, shortenModel } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import { ScrollShadows } from '@/components/scroll-shadows';

export interface PricingRow {
  model: string;
  input: number;
  output: number;
  cacheCreation5m: number;
  cacheCreation1h: number;
  cacheRead: number;
}

type SortKey = keyof Omit<PricingRow, 'model'> | 'model';

export function PricingTable({ rows }: { rows: PricingRow[] }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('model');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'model' ? 'asc' : 'desc');
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.model.toLowerCase().includes(q) || shortenModel(r.model).toLowerCase().includes(q),
    );
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      if (sortKey === 'model') {
        const cmp = a.model.localeCompare(b.model);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      return sortDir === 'asc' ? (av < bv ? -1 : 1) : av < bv ? 1 : -1;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('common.searchPlaceholder')}
          aria-label={t('common.searchPlaceholder')}
          className="px-3 py-1.5 text-sm rounded-button border border-border bg-bg-surface focus:outline-none focus:border-border-hi w-72 placeholder:text-text-tertiary text-text-primary"
        />
        <span className="text-xs text-text-tertiary tabular-nums">
          {t('common.rows', { count: sorted.length.toLocaleString() })}
        </span>
      </div>
      <ScrollShadows>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <Th sorted={sortKey === 'model'} dir={sortDir} onClick={() => toggleSort('model')}>
                {t('settings.pricing.col.model')}
              </Th>
              <Th align="right" sorted={sortKey === 'input'} dir={sortDir} onClick={() => toggleSort('input')}>
                {t('settings.pricing.col.input')}
              </Th>
              <Th align="right" sorted={sortKey === 'output'} dir={sortDir} onClick={() => toggleSort('output')}>
                {t('settings.pricing.col.output')}
              </Th>
              <Th align="right" sorted={sortKey === 'cacheCreation5m'} dir={sortDir} onClick={() => toggleSort('cacheCreation5m')}>
                {t('settings.pricing.col.write5m')}
              </Th>
              <Th align="right" sorted={sortKey === 'cacheCreation1h'} dir={sortDir} onClick={() => toggleSort('cacheCreation1h')}>
                {t('settings.pricing.col.write1h')}
              </Th>
              <Th align="right" sorted={sortKey === 'cacheRead'} dir={sortDir} onClick={() => toggleSort('cacheRead')}>
                {t('settings.pricing.col.read')}
              </Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.model} className="border-b border-border last:border-b-0 hover:bg-bg-surface-hi/30">
                <td className="px-3 py-2 text-text-primary" title={p.model}>
                  {shortenModel(p.model)}
                </td>
                <td className="px-3 py-2 num-mono text-right">{formatUSD(p.input)}</td>
                <td className="px-3 py-2 num-mono text-right">{formatUSD(p.output)}</td>
                <td className="px-3 py-2 num-mono text-right text-text-secondary">{formatUSD(p.cacheCreation5m)}</td>
                <td className="px-3 py-2 num-mono text-right text-text-secondary">{formatUSD(p.cacheCreation1h)}</td>
                <td className="px-3 py-2 num-mono text-right text-success">{formatUSD(p.cacheRead)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-text-tertiary text-sm">
                  {t('common.noMatchingRows')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollShadows>
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
      onClick={onClick}
      className={cn(
        'px-3 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
        onClick && 'cursor-pointer hover:text-text-primary select-none',
      )}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sorted && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </span>
    </th>
  );
}
