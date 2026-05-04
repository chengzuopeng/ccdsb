import Link from 'next/link';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateByProject } from '@/lib/aggregator';
import { PageShell, EmptyState } from '@/components/section';
import {
  formatTokensCompact,
  formatUSD,
  formatRelative,
  shortenModel,
} from '@/lib/utils';
import { getServerT, getServerLocale } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ProjectsPage() {
  const t = await getServerT();
  const locale = await getServerLocale();
  const scan = await getCachedScan();
  if (scan.records.length === 0) {
    return (
      <PageShell title={t('projects.title')}>
        <EmptyState title={t('projects.empty')} />
      </PageShell>
    );
  }
  const projects = aggregateByProject(scan.records);
  const totalCost = projects.reduce((s, p) => s + p.cost, 0);

  return (
    <PageShell title={t('projects.title')} desc={t('projects.subtitle', { count: projects.length })}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => {
          const pct = totalCost > 0 ? p.cost / totalCost : 0;
          return (
            <Link
              key={p.cwd}
              href={`/projects/${encodeURIComponent(p.cwd)}`}
              className="card card-pad hover:border-border-hi transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-text-primary truncate group-hover:text-brand transition-colors">
                    {p.projectName}
                  </div>
                  <div className="text-xs text-text-tertiary truncate mt-0.5" title={p.cwd}>
                    {p.cwd}
                  </div>
                </div>
                <div className="num-mono text-text-primary text-right whitespace-nowrap">{formatUSD(p.cost)}</div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <Stat label={t('projects.stat.sessions')} value={p.sessions} />
                <Stat label={t('projects.stat.requests')} value={p.requests} />
                <Stat label={t('projects.stat.tokens')} value={formatTokensCompact(p.totalTokens, locale)} />
              </div>

              <div className="mt-4 h-1.5 bg-bg-surface-hi rounded overflow-hidden">
                <div className="h-full bg-brand rounded" style={{ width: `${pct * 100}%` }} />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-text-tertiary gap-2">
                <span className="whitespace-nowrap">
                  {t('common.lastActivity')} {formatRelative(p.lastActivity, locale)}
                </span>
                <span className="truncate">{p.models.map(shortenModel).join(', ')}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-text-tertiary">{label}</div>
      <div className="num-mono text-text-primary mt-0.5">{value}</div>
    </div>
  );
}
