import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: { value: number; positiveIsGood?: boolean } | null;
  deltaTitle?: string;
  progress?: { value: number; tone?: 'brand' | 'success' | 'warning' | 'danger' } | null;
  accent?: 'brand' | 'success' | 'warning' | 'default';
  className?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaTitle,
  progress,
  accent = 'default',
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'card card-pad flex flex-col gap-2 min-h-[128px] transition-colors',
        accent === 'brand' && 'border-brand/30',
        accent === 'success' && 'border-success/30',
        accent === 'warning' && 'border-warning/30',
        className,
      )}
    >
      <div className="label">{label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="num-hero">{value}</div>
        {delta && Number.isFinite(delta.value) && (
          <DeltaPill value={delta.value} positiveIsGood={delta.positiveIsGood} title={deltaTitle} />
        )}
      </div>
      {hint && <div className="text-xs text-text-secondary mt-auto leading-snug">{hint}</div>}
      {progress && (
        <div className="mt-auto pt-2">
          <ProgressBar value={progress.value} tone={progress.tone} />
        </div>
      )}
    </div>
  );
}

function DeltaPill({
  value,
  positiveIsGood = true,
  title,
}: {
  value: number;
  positiveIsGood?: boolean;
  title?: string;
}) {
  const positive = value >= 0;
  const good = positive === positiveIsGood;
  return (
    <span
      className={cn(
        'pill text-[11px] font-medium whitespace-nowrap',
        good ? 'text-success bg-success/10' : 'text-danger bg-danger/10',
      )}
      title={title}
    >
      {positive ? '↑' : '↓'} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function ProgressBar({
  value,
  tone = 'brand',
}: {
  value: number;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
}) {
  const pct = Math.max(0, Math.min(1, value));
  const colorMap = {
    brand: 'bg-brand',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  } as const;
  return (
    <div className="h-1.5 w-full bg-bg-surface-hi rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all', colorMap[tone])}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="card card-pad min-h-[128px] animate-pulse">
      <div className="h-3 w-20 bg-bg-surface-hi rounded mb-3" />
      <div className="h-8 w-32 bg-bg-surface-hi rounded mb-2" />
      <div className="h-3 w-24 bg-bg-surface-hi rounded mt-auto" />
    </div>
  );
}
