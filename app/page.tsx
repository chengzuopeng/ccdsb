import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateByModel, aggregateByTime, aggregateTotals } from '@/lib/aggregator';
import { blockProgress } from '@/lib/blocks/compute';
import { KpiCard } from '@/components/kpi-card';
import { Section, PageShell, EmptyState } from '@/components/section';
import { TokenStackChart, type TokenStackDatum } from '@/components/charts/token-stack-chart';
import { ModelBarChart } from '@/components/charts/model-bar-chart';
import { BlockProgress } from '@/components/block-progress';
import { blockToSerialized } from '@/lib/serialize';
import {
  formatTokensCompact,
  formatUSD,
  formatPct,
} from '@/lib/utils';
import { getServerT, getServerLocale } from '@/lib/i18n/server';
import { resolveSource, filterBySource } from '@/lib/source';
import { getProvider } from '@/lib/providers';
import { computeActivityStats, pickTokenComparison } from '@/lib/aggregator/activity';
import { ActivityStatsSection } from '@/components/activity-stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isToday(ts: string): boolean {
  const d = new Date(ts);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isYesterday(ts: string): boolean {
  const d = new Date(ts);
  const ref = new Date();
  ref.setDate(ref.getDate() - 1);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function isThisMonth(ts: string): boolean {
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  const sp = await searchParams;
  const source = await resolveSource(sp.source);
  return <OverviewContent source={source} />;
}

async function OverviewContent({ source }: { source: 'claude' | 'codex' }) {
  const scan = await getCachedScan();
  const records = filterBySource(scan.records, source);
  const t = await getServerT();
  const locale = await getServerLocale();
  const fmtTokens = (n: number) => formatTokensCompact(n, locale);
  const provider = getProvider(source);
  const shorten = (m: string) => provider.shortenModel(m);

  if (records.length === 0) {
    return (
      <PageShell title={t('overview.title')} desc={t('brand.tagline')}>
        <EmptyState
          title={t('overview.empty.title')}
          desc={t('overview.subtitle.empty', { dirs: scan.stats.scannedDirs.length })}
        />
      </PageShell>
    );
  }

  const todayRecs = records.filter((r) => isToday(r.timestamp));
  const yesterdayRecs = records.filter((r) => isYesterday(r.timestamp));
  const monthRecs = records.filter((r) => isThisMonth(r.timestamp));

  const opts = { source };
  const today = aggregateTotals(todayRecs, opts);
  const yest = aggregateTotals(yesterdayRecs, opts);
  const month = aggregateTotals(monthRecs, opts);

  const hasYesterday = yest.totalTokens > 0 || yest.cost > 0;
  const tokenDelta = yest.totalTokens > 0 ? ((today.totalTokens - yest.totalTokens) / yest.totalTokens) * 100 : NaN;
  const costDelta = yest.cost > 0 ? ((today.cost - yest.cost) / yest.cost) * 100 : NaN;
  const firstTimeDelta = !hasYesterday && (today.totalTokens > 0 || today.cost > 0)
    ? { firstTime: true as const, label: t('overview.delta.firstTime') }
    : null;

  const cacheHit =
    today.cacheReadTokens + today.inputTokens > 0
      ? today.cacheReadTokens / (today.cacheReadTokens + today.inputTokens + today.cacheCreationTokens)
      : 0;

  const block = blockProgress(records, provider.capabilities.blockWindowMs);
  const serializedBlock = blockToSerialized(block);

  const thirtyAgo = new Date();
  thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const trendBuckets = aggregateByTime(records, 'day', { source, from: thirtyAgo });
  const trendData: TokenStackDatum[] = trendBuckets.map((b) => ({
    label: b.label,
    input: b.inputTokens,
    output: b.outputTokens,
    cacheRead: b.cacheReadTokens,
    cacheCreation: b.cacheCreationTokens,
    cost: b.cost,
    requests: b.requests,
  }));

  const activeDays = trendBuckets.length;
  const activeDaysHint =
    activeDays === 1
      ? t('overview.trend.activeDays', { n: 1 })
      : t('overview.trend.activeDays.plural', { n: activeDays });

  const monthModels = aggregateByModel(records, { source, from: startOfMonth() });
  const topModel = monthModels[0];
  const topModelPct =
    topModel && month.cost > 0 ? formatPct(topModel.cost / month.cost) : '—';

  const costFootnote = provider.costFootnoteKey ? t(provider.costFootnoteKey) : '';

  // Use the active source's stats for the overview header so users don't see
  // global file/record counts when the dashboard is filtered to one provider.
  const sourceStat = scan.bySource.find((s) => s.source === source);
  const sourceFileCount = sourceStat?.filesScanned ?? 0;
  const sourceRecordCount = sourceStat?.assistantRecords ?? records.length;

  return (
    <PageShell
      title={t('overview.title')}
      desc={t('overview.subtitle', {
        count: sourceRecordCount.toLocaleString(),
        files: sourceFileCount,
        ms: scan.stats.durationMs,
      })}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label={t('overview.kpi.tokensToday')}
          value={fmtTokens(today.totalTokens)}
          hint={t('overview.kpi.tokensToday.hint', { count: today.requests })}
          delta={Number.isFinite(tokenDelta) ? { value: tokenDelta, positiveIsGood: false } : firstTimeDelta}
          deltaTitle={t('overview.delta.title')}
        />
        <KpiCard
          label={t('overview.kpi.costToday')}
          value={formatUSD(today.cost)}
          hint={costFootnote || t('common.savedTodayViaCache', { amount: formatUSD(today.saved) })}
          delta={Number.isFinite(costDelta) ? { value: costDelta, positiveIsGood: false } : firstTimeDelta}
          deltaTitle={t('overview.delta.title')}
        />
        <KpiCard
          label={t('overview.kpi.thisMonth')}
          value={formatUSD(month.cost)}
          hint={t('overview.kpi.thisMonth.hint', {
            tokens: fmtTokens(month.totalTokens),
            req: month.requests,
          })}
        />
        <KpiCard
          label={t('overview.kpi.cacheHit')}
          value={formatPct(cacheHit, 0)}
          hint={t('overview.kpi.cacheHit.hint', { amount: formatUSD(today.saved) })}
          accent="success"
          progress={{ value: cacheHit, tone: 'success' }}
        />
        <KpiCard
          label={t('overview.kpi.topModel')}
          value={topModel ? shorten(topModel.model) : '—'}
          hint={topModel ? t('overview.kpi.topModel.hint', { pct: topModelPct }) : ''}
          accent="brand"
        />
        <KpiCard
          label={t('overview.kpi.activeSessions')}
          value={String(new Set(todayRecs.map((r) => r.sessionId)).size)}
          hint={t('overview.kpi.activeSessions.hint', {
            count: new Set(todayRecs.map((r) => r.cwd)).size,
          })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Section
            title={t('overview.trend.title')}
            desc={t('overview.trend.desc')}
            right={<span className="text-xs text-text-tertiary">{activeDaysHint}</span>}
          >
            <TokenStackChart data={trendData} />
          </Section>
        </div>
        <BlockProgress initial={serializedBlock} />
      </div>

      <Section title={t('overview.costByModel.title')} desc={t('overview.costByModel.desc')}>
        <ModelBarChart models={monthModels.slice(0, 8)} />
      </Section>

      <ActivityStatsSection
        stats={computeActivityStats(records, { source })}
        comparison={pickTokenComparison(
          records.reduce(
            (s, r) =>
              s +
              r.usage.input_tokens +
              r.usage.output_tokens +
              r.usage.cache_read_input_tokens +
              r.usage.cache_creation_input_tokens,
            0,
          ),
        )}
        locale={locale}
      />
    </PageShell>
  );
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
