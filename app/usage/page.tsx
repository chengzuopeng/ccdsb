import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateByTime, aggregateTotals, type Granularity } from '@/lib/aggregator';
import { Section, PageShell, EmptyState } from '@/components/section';
import { TokenStackChart, type TokenStackDatum } from '@/components/charts/token-stack-chart';
import { UsageTable } from '@/components/usage-table';
import { recordsToTableRows } from '@/lib/serialize';
import { RangePicker } from '@/components/range-picker';
import { rangeToDates } from '@/lib/range';
import { GranularityPicker } from '@/components/granularity-picker';
import { ModelFilter } from '@/components/model-filter';
import { ProjectFilter } from '@/components/project-filter';
import { KpiCard } from '@/components/kpi-card';
import { formatTokensCompact, formatUSD, formatPct } from '@/lib/utils';
import { getServerT } from '@/lib/i18n/server';
import { tFn } from '@/lib/i18n/dict';
import { getServerLocale } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; gran?: string; models?: string; projects?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range || '7d';
  const gran = (sp.gran || (range === '1d' ? 'hour' : 'day')) as Granularity;
  const models = sp.models ? sp.models.split(',').filter(Boolean) : [];
  const projects = sp.projects ? sp.projects.split(',').filter(Boolean) : [];

  const t = await getServerT();
  const locale = await getServerLocale();
  const scan = await getCachedScan();
  const dates = rangeToDates(range);

  const opts = {
    from: dates.from,
    to: dates.to,
    models: models.length ? models : undefined,
    projects: projects.length ? projects : undefined,
  };

  const totals = aggregateTotals(scan.records, opts);
  const buckets = aggregateByTime(scan.records, gran, opts);
  const trend: TokenStackDatum[] = buckets.map((b) => ({
    label: b.label,
    input: b.inputTokens,
    output: b.outputTokens,
    cacheRead: b.cacheReadTokens,
    cacheCreation: b.cacheCreationTokens,
    cost: b.cost,
    requests: b.requests,
  }));

  const filteredRecords = scan.records.filter((r) => {
    if (dates.from && r.timestamp < dates.from.toISOString()) return false;
    if (models.length && !models.includes(r.model)) return false;
    if (projects.length && !projects.includes(r.cwd)) return false;
    return true;
  });

  const tableRows = recordsToTableRows(filteredRecords);

  const allModels = Array.from(new Set(scan.records.map((r) => r.model))).sort();
  const allProjects = Array.from(new Set(scan.records.map((r) => r.cwd).filter(Boolean))).sort();

  const cacheHit =
    totals.totalTokens > 0
      ? totals.cacheReadTokens /
        Math.max(1, totals.cacheReadTokens + totals.inputTokens + totals.cacheCreationTokens)
      : 0;

  return (
    <PageShell
      title={t('usage.title')}
      desc={t('usage.subtitle', { count: tableRows.length.toLocaleString() })}
      right={<RangePicker defaultValue="7d" />}
    >
      {scan.records.length === 0 ? (
        <EmptyState title={t('common.empty.title')} desc={t('common.empty.desc')} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label={t('usage.kpi.totalTokens')} value={formatTokensCompact(totals.totalTokens)} />
            <KpiCard label={t('usage.kpi.totalCost')} value={formatUSD(totals.cost)} />
            <KpiCard label={t('usage.kpi.cacheSaved')} value={formatUSD(totals.saved)} accent="success" />
            <KpiCard label={t('usage.kpi.cacheHit')} value={formatPct(cacheHit, 0)} accent="success" />
          </div>

          <Section
            title={t('usage.trend')}
            desc={t('usage.trend.gran', { gran: tFn(locale, `gran.${gran}`) })}
            right={
              <div className="flex items-center gap-2 flex-wrap">
                <ModelFilter all={allModels} selected={models} />
                <ProjectFilter all={allProjects} selected={projects} />
                <GranularityPicker defaultValue={gran} />
              </div>
            }
          >
            <TokenStackChart data={trend} />
          </Section>

          <Section title={t('usage.requests.title')} desc={t('usage.requests.desc')}>
            <UsageTable rows={tableRows} />
          </Section>
        </>
      )}
    </PageShell>
  );
}
