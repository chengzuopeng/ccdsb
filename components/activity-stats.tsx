import { cn } from '@/lib/utils';
import { Section } from '@/components/section';
import type { ActivityStats, TokenComparison } from '@/lib/aggregator/activity';
import type { Locale } from '@/lib/i18n/dict';
import { tFn } from '@/lib/i18n/dict';
import { formatTokensCompact } from '@/lib/utils';

interface Props {
  stats: ActivityStats;
  comparison: TokenComparison | null;
  shortenModel: (m: string) => string;
  locale: Locale;
}

export function ActivityStatsSection({ stats, comparison, shortenModel, locale }: Props) {
  const t = (key: string, vars?: Record<string, string | number>) => tFn(locale, key, vars);

  const tiles: Array<{ label: string; value: string }> = [
    { label: t('activity.sessions'), value: stats.sessions.toLocaleString() },
    { label: t('activity.messages'), value: stats.messages.toLocaleString() },
    { label: t('activity.totalTokens'), value: formatTokensCompact(stats.totalTokens, locale) },
    { label: t('activity.activeDays'), value: stats.activeDays.toLocaleString() },
    { label: t('activity.currentStreak'), value: t('activity.streakValue', { n: stats.currentStreak }) },
    { label: t('activity.longestStreak'), value: t('activity.streakValue', { n: stats.longestStreak }) },
    { label: t('activity.peakHour'), value: stats.peakHour < 0 ? '—' : formatHour(stats.peakHour, locale) },
    { label: t('activity.favoriteModel'), value: stats.favoriteModel ? shortenModel(stats.favoriteModel) : '—' },
  ];

  return (
    <Section title={t('activity.title')} desc={t('activity.subtitle')}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <Tile key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </div>

      <div className="mt-5">
        <Heatmap data={stats.heatmap} max={stats.heatmapMax} locale={locale} />
      </div>

      {comparison && (
        <div className="mt-4 text-xs text-text-tertiary leading-relaxed">
          {t('activity.comparison', {
            multiplier: formatMultiplier(comparison.multiplier),
            ref: t(`activity.ref.${comparison.refKey}`),
          })}
        </div>
      )}
    </Section>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-button bg-bg-surface-hi/60 border border-border px-3.5 py-3">
      <div className="text-[11px] uppercase tracking-[0.06em] text-text-tertiary font-semibold truncate">
        {label}
      </div>
      <div className="num-mono text-xl font-semibold text-text-primary mt-1 leading-none truncate">
        {value}
      </div>
    </div>
  );
}

function Heatmap({ data, max, locale }: { data: number[][]; max: number; locale: Locale }) {
  const t = (key: string, vars?: Record<string, string | number>) => tFn(locale, key, vars);
  // Show every 6th hour as a column label below the grid.
  const HOURS = [0, 6, 12, 18];
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[auto_1fr] gap-2">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] pt-[1px] pr-1 text-[10px] text-text-tertiary tabular-nums">
          {Array.from({ length: 7 }).map((_, dow) => (
            <div key={dow} className="h-[14px] leading-[14px]">
              {dow % 2 === 1 ? t(`activity.dow.${dow}`) : ''}
            </div>
          ))}
        </div>
        {/* Cells: 7 rows × 24 cols */}
        <div className="flex flex-col gap-[3px]">
          {data.map((row, dow) => (
            <div key={dow} className="grid grid-cols-24 gap-[3px]">
              {row.map((count, hour) => (
                <Cell key={hour} count={count} max={max} dow={dow} hour={hour} locale={locale} />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Hour scale */}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <div className="text-[10px] text-text-tertiary opacity-0 select-none pr-1">.</div>
        <div className="grid grid-cols-24 text-[10px] text-text-tertiary tabular-nums">
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-center leading-none">
              {HOURS.includes(h) ? formatHourShort(h, locale) : ''}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cell({
  count,
  max,
  dow,
  hour,
  locale,
}: {
  count: number;
  max: number;
  dow: number;
  hour: number;
  locale: Locale;
}) {
  // Smooth-ish opacity scale with a sqrt curve so a single message on a
  // mostly-empty grid is still visible.
  const intensity = max > 0 && count > 0 ? Math.sqrt(count / max) : 0;
  const t = (key: string, vars?: Record<string, string | number>) => tFn(locale, key, vars);
  const title = t('activity.heatmap.tooltip', {
    dow: t(`activity.dow.${dow}`),
    hour: formatHour(hour, locale),
    count: count.toLocaleString(),
  });
  const style: React.CSSProperties = count
    ? { backgroundColor: `rgb(var(--brand) / ${(0.18 + intensity * 0.82).toFixed(2)})` }
    : {};
  return (
    <div
      title={title}
      className={cn('h-[14px] w-full rounded-[3px]', !count && 'bg-bg-surface-hi')}
      style={style}
    />
  );
}

function formatHour(h: number, locale: Locale): string {
  if (locale === 'zh') return `${h}:00`;
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function formatHourShort(h: number, locale: Locale): string {
  if (locale === 'zh') return `${h}`;
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

function formatMultiplier(m: number): string {
  if (m < 10) return m.toFixed(1);
  if (m < 1000) return Math.round(m).toString();
  if (m < 1_000_000) return (m / 1000).toFixed(1) + 'K';
  return (m / 1_000_000).toFixed(1) + 'M';
}
