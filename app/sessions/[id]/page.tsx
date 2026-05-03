import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateBySession } from '@/lib/aggregator';
import { Section, PageShell } from '@/components/section';
import { KpiCard } from '@/components/kpi-card';
import { TokenStackChart, type TokenStackDatum } from '@/components/charts/token-stack-chart';
import { costOfRecord } from '@/lib/pricing/calculate';
import {
  formatTokensCompact,
  formatUSD,
  formatRelative,
  formatDateTime,
  formatDuration,
  shortenModel,
  shortHash,
  projectNameFromCwd,
} from '@/lib/utils';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionId = decodeURIComponent(id);
  const t = await getServerT();
  const scan = await getCachedScan();

  const sessionRecords = scan.records.filter((r) => r.sessionId === sessionId);
  if (sessionRecords.length === 0) notFound();

  const sessions = aggregateBySession(sessionRecords, scan.userRecords);
  const session = sessions[0];

  const messages = sessionRecords
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((r) => ({
      uuid: r.uuid,
      timestamp: r.timestamp,
      model: r.model,
      input: r.usage.input_tokens,
      output: r.usage.output_tokens,
      cacheRead: r.usage.cache_read_input_tokens,
      cacheCreation: r.usage.cache_creation_input_tokens,
      cost: costOfRecord(r).total,
      tools: r.toolNames,
      thinking: r.hasThinking,
      preview: r.textPreview,
    }));

  const trend: TokenStackDatum[] = messages.map((m, i) => ({
    label: `#${i + 1}`,
    input: m.input,
    output: m.output,
    cacheRead: m.cacheRead,
    cacheCreation: m.cacheCreation,
    cost: m.cost,
    requests: 1,
  }));

  return (
    <PageShell
      title={session.title || t('sessions.untitled', { hash: shortHash(sessionId, 12) })}
      desc={
        <>
          <span className="num-mono">{shortHash(sessionId, 16)}</span>
          {' · '}
          <Link href={`/projects/${encodeURIComponent(session.cwd)}`} className="hover:text-brand">
            {projectNameFromCwd(session.cwd)}
          </Link>
        </>
      }
      right={
        <Link href="/sessions" className="btn-ghost">
          {t('common.allSessions')}
        </Link>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label={t('session.kpi.requests')} value={String(session.requests)} />
        <KpiCard label={t('session.kpi.totalTokens')} value={formatTokensCompact(session.totalTokens)} />
        <KpiCard label={t('session.kpi.cost')} value={formatUSD(session.cost)} />
        <KpiCard label={t('session.kpi.duration')} value={formatDuration(session.durationMs)} />
      </div>

      <Section title={t('session.perMessage.title')}>
        <TokenStackChart data={trend} />
      </Section>

      <Section title={t('session.modelsInSession')}>
        <div className="space-y-2">
          {Object.entries(session.modelBreakdown).map(([model, mb]) => (
            <div key={model} className="flex items-center justify-between text-sm gap-3">
              <span className="text-text-primary min-w-[120px]">{shortenModel(model)}</span>
              <span className="text-text-secondary flex-1">
                {t('session.modelLine', {
                  requests: mb.requests,
                  tokens: formatTokensCompact(mb.tokens),
                })}
              </span>
              <span className="num-mono text-text-primary font-medium">{formatUSD(mb.cost)}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('session.timeline.title')} desc={t('session.timeline.desc')}>
        <div className="space-y-2">
          {messages.map((m, i) => (
            <div
              key={m.uuid}
              className="border border-border rounded-button p-3 hover:bg-bg-surface-hi/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-3 text-xs text-text-tertiary mb-1">
                <span>
                  #{i + 1} · {shortenModel(m.model)} · {formatDateTime(m.timestamp)}{' '}
                  <span className="text-text-tertiary">({formatRelative(m.timestamp)})</span>
                </span>
                <span className="num-mono text-text-primary font-medium">{formatUSD(m.cost)}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs num-mono mt-2">
                <div>
                  <span className="text-text-tertiary">{t('session.token.in')}</span>{' '}
                  <span className="text-text-secondary">{formatTokensCompact(m.input)}</span>
                </div>
                <div>
                  <span className="text-text-tertiary">{t('session.token.out')}</span>{' '}
                  <span className="text-text-secondary">{formatTokensCompact(m.output)}</span>
                </div>
                <div>
                  <span className="text-text-tertiary">{t('session.token.cacheR')}</span>{' '}
                  <span className="text-success">{formatTokensCompact(m.cacheRead)}</span>
                </div>
                <div>
                  <span className="text-text-tertiary">{t('session.token.cacheW')}</span>{' '}
                  <span className="text-text-secondary">{formatTokensCompact(m.cacheCreation)}</span>
                </div>
              </div>
              {(m.tools.length > 0 || m.thinking || m.preview) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  {m.thinking && (
                    <span className="pill bg-chart-cache-create/15 text-chart-cache-create">
                      {t('common.thinking')}
                    </span>
                  )}
                  {m.tools.slice(0, 5).map((tool, j) => (
                    <span key={j} className="pill-muted">{tool}</span>
                  ))}
                  {m.tools.length > 5 && <span className="text-text-tertiary">+{m.tools.length - 5}</span>}
                </div>
              )}
              {m.preview && (
                <div className="mt-2 text-xs text-text-secondary truncate" title={m.preview}>
                  {m.preview}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
