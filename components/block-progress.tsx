'use client';

import { useEffect, useState } from 'react';
import { cn, formatUSD, formatTokensCompact } from '@/lib/utils';
import type { SerializedProgress } from '@/lib/serialize';
import { useT, useI18n } from '@/lib/i18n/context';

interface Props {
  initial: SerializedProgress;
  className?: string;
  /** Optional small inline tag after the title (e.g. "· Claude"). */
  sourceLabel?: string;
  /** Compact mode shrinks padding + min-height so two cards fit on one
   *  row at most viewport widths. */
  compact?: boolean;
  /** Replaces the default top-right slot — by default that slot is the
   *  "live" pill on an active block, nothing on the empty state. The
   *  All view passes a source-switcher tablist here instead. */
  headerRight?: React.ReactNode;
  /** Full CLI name used in the empty-state hint
   *  ("Send a message in {cli} to start one."). Defaults to "Claude Code"
   *  for backwards compatibility, but callers viewing the Codex source
   *  must pass "Codex CLI" so the hint matches what the user has open. */
  cliName?: string;
}

export function BlockProgress({
  initial,
  className,
  sourceLabel,
  compact,
  headerRight,
  cliName = 'Claude Code',
}: Props) {
  const t = useT();
  const { locale } = useI18n();
  const fmtTokens = (n: number) => formatTokensCompact(n, locale);

  const cardCls = cn(
    'card flex flex-col',
    compact ? 'p-4 min-h-[160px]' : 'card-pad min-h-[180px]',
    className,
  );

  const headerLeft = (
    <div className="flex items-center gap-2 min-w-0">
      <div className="label whitespace-nowrap">{t('block.title')}</div>
      {sourceLabel && (
        <span className="text-[10px] uppercase tracking-wide text-text-tertiary font-medium whitespace-nowrap">
          · {sourceLabel}
        </span>
      )}
    </div>
  );

  if (!initial.hasBlock || !initial.endTime || !initial.startTime) {
    return (
      <div className={cardCls}>
        <div className="flex items-center justify-between gap-2">
          {headerLeft}
          {/* No default right-slot in the empty state; the switcher (if
              caller passed one) lives here so users can still switch to
              another provider whose block IS active. */}
          {headerRight}
        </div>
        <div className="text-sm text-text-tertiary mt-4">{t('block.empty')}</div>
        <div className="text-xs text-text-tertiary mt-1">
          {t('block.emptyDesc', { cli: cliName })}
        </div>
      </div>
    );
  }

  // Default right-slot for an active block is the "live" pill; the
  // visible countdown below already conveys liveness, so a caller-provided
  // headerRight (e.g. tab switcher) cleanly replaces it without losing
  // critical info.
  const defaultLivePill = (
    <span className="pill bg-success/10 text-success border border-success/20 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-success mr-1 animate-pulse" />
      {t('common.live')}
    </span>
  );

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between gap-2">
        {headerLeft}
        {headerRight ?? defaultLivePill}
      </div>

      <LiveCountdown
        startTime={initial.startTime}
        endTime={initial.endTime}
        totalTokens={initial.totalTokens}
        remainingLabel={t('block.remaining')}
        renderElapsed={(pct) => t('block.elapsed', { pct })}
        tokensSuffix={t('block.tokensSuffix')}
        fmtTokens={fmtTokens}
      />

      <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-text-tertiary">{t('block.spentSoFar')}</div>
          <div className="num-mono text-text-primary mt-0.5 text-base">{formatUSD(initial.cost)}</div>
        </div>
        <div>
          <div className="text-text-tertiary">{t('block.burnPerMin')}</div>
          <div className="num-mono text-text-primary mt-0.5 text-base">
            {fmtTokens(initial.burnRatePerMin)}
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

      <div className="mt-auto pt-3 text-[11px] leading-relaxed text-text-tertiary">
        {t('block.disclaimer')}
      </div>
    </div>
  );
}

interface LiveProps {
  startTime: string;
  endTime: string;
  totalTokens: number;
  remainingLabel: string;
  renderElapsed: (pct: string) => string;
  tokensSuffix: string;
  fmtTokens: (n: number) => string;
}

function LiveCountdown({
  startTime,
  endTime,
  totalTokens,
  remainingLabel,
  renderElapsed,
  tokensSuffix,
  fmtTokens,
}: LiveProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const elapsedMs = Math.max(0, now - startMs);
  const remainingMs = Math.max(0, endMs - now);
  const total = endMs - startMs;
  const progress = Math.min(1, elapsedMs / total);
  const elapsedText = renderElapsed((progress * 100).toFixed(1));

  return (
    <>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="num-hero">{formatRemaining(remainingMs)}</div>
        <div className="text-xs text-text-secondary">{remainingLabel}</div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>{elapsedText}</span>
          <span className="num-mono">
            {fmtTokens(totalTokens)} {tokensSuffix}
          </span>
        </div>
        <div className="h-1.5 bg-bg-surface-hi rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand to-brand-hover transition-all"
            style={{ width: `${progress * 100}%` }}
            suppressHydrationWarning
          />
        </div>
      </div>
    </>
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
