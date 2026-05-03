'use client';

import { useEffect, useState } from 'react';
import { formatUSD, formatTokensCompact } from '@/lib/utils';
import type { SerializedProgress } from '@/lib/serialize';
import { useT } from '@/lib/i18n/context';

interface Props {
  initial: SerializedProgress;
}

export function BlockProgress({ initial }: Props) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!initial.hasBlock || !initial.endTime || !initial.startTime) {
    return (
      <div className="card card-pad min-h-[180px] flex flex-col">
        <div className="label">{t('block.title')}</div>
        <div className="text-sm text-text-tertiary mt-4">{t('block.empty')}</div>
        <div className="text-xs text-text-tertiary mt-1">{t('block.emptyDesc')}</div>
      </div>
    );
  }

  const startMs = new Date(initial.startTime).getTime();
  const endMs = new Date(initial.endTime).getTime();
  const elapsedMs = Math.max(0, now - startMs);
  const remainingMs = Math.max(0, endMs - now);
  const total = endMs - startMs;
  const progress = Math.min(1, elapsedMs / total);

  return (
    <div className="card card-pad min-h-[180px]">
      <div className="flex items-center justify-between">
        <div className="label">{t('block.title')}</div>
        <span className="pill bg-success/10 text-success border border-success/20">
          <span className="w-1.5 h-1.5 rounded-full bg-success mr-1 animate-pulse" />
          {t('common.live')}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <div className="num-hero">{formatRemaining(remainingMs)}</div>
        <div className="text-xs text-text-secondary">{t('block.remaining')}</div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>{t('block.elapsed', { pct: (progress * 100).toFixed(1) })}</span>
          <span className="num-mono">{formatTokensCompact(initial.totalTokens)} {t('block.tokensSuffix')}</span>
        </div>
        <div className="h-1.5 bg-bg-surface-hi rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand to-brand-hover transition-all"
            style={{ width: `${progress * 100}%` }}
            suppressHydrationWarning
          />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-text-tertiary">{t('block.spentSoFar')}</div>
          <div className="num-mono text-text-primary mt-0.5 text-base">{formatUSD(initial.cost)}</div>
        </div>
        <div>
          <div className="text-text-tertiary">{t('block.burnPerMin')}</div>
          <div className="num-mono text-text-primary mt-0.5 text-base">
            {formatTokensCompact(initial.burnRatePerMin)}
          </div>
        </div>
        <div>
          <div className="text-text-tertiary">{t('block.projectedTotal')}</div>
          <div className="num-mono text-text-secondary mt-0.5">{formatUSD(initial.projectedCost)}</div>
        </div>
        <div>
          <div className="text-text-tertiary">{t('block.requests')}</div>
          <div className="num-mono text-text-secondary mt-0.5">{initial.requests}</div>
        </div>
      </div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0s';
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}
