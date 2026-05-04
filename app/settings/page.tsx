import { getCachedScan, getScannedDirs } from '@/lib/data-loader/scan';
import { BUILTIN_PRICING } from '@/lib/pricing/builtin';
import { PageShell, Section } from '@/components/section';
import { formatUSD, shortenModel } from '@/lib/utils';
import { ScanRefresh } from '@/components/scan-refresh';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { getServerT } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const VERSION = '0.1.0';

export default async function SettingsPage() {
  const t = await getServerT();
  const scan = await getCachedScan();
  const dirs = getScannedDirs();

  return (
    <PageShell title={t('settings.title')} desc={t('settings.subtitle')}>
      <Section title={t('settings.preferences.title')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between gap-4 p-3 rounded-button border border-border">
            <div>
              <div className="font-medium text-text-primary text-sm">{t('settings.preferences.language')}</div>
              <div className="text-xs text-text-tertiary mt-0.5">English / 中文</div>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between gap-4 p-3 rounded-button border border-border">
            <div>
              <div className="font-medium text-text-primary text-sm">{t('settings.preferences.theme')}</div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {t('settings.theme.light')} / {t('settings.theme.dark')} / {t('settings.theme.system')}
              </div>
            </div>
            <ThemeSwitcher />
          </div>
        </div>
      </Section>

      <Section title={t('settings.dataSources.title')} desc={t('settings.dataSources.desc')}>
        <div className="space-y-2">
          {dirs.map((d) => {
            const isActive = scan.stats.scannedDirs.includes(d);
            return (
              <div
                key={d}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-button border border-border bg-bg-surface-hi/30"
              >
                <span className="num-mono text-sm text-text-primary truncate">{d}</span>
                <span
                  className={`pill text-xs whitespace-nowrap ${
                    isActive
                      ? 'bg-success/10 text-success border border-success/20'
                      : 'bg-bg-surface-hi text-text-tertiary'
                  }`}
                >
                  {isActive ? t('settings.dataSources.active') : t('settings.dataSources.notPresent')}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-4 text-xs text-text-secondary">
          {t('settings.dataSources.envHint', {
            env1: 'CCGAUGE_CONFIG_DIR',
            env2: 'CLAUDE_CONFIG_DIR',
            appendix: '/projects',
          })}
        </div>
        <div className="mt-4">
          <ScanRefresh />
        </div>
      </Section>

      <Section title={t('settings.scanStats.title')}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Stat label={t('settings.scanStats.files')} value={String(scan.stats.filesScanned)} />
          <Stat label={t('settings.scanStats.records')} value={scan.stats.recordsParsed.toLocaleString()} />
          <Stat label={t('settings.scanStats.assistant')} value={scan.stats.assistantRecords.toLocaleString()} />
          <Stat label={t('settings.scanStats.duration')} value={`${scan.stats.durationMs} ms`} />
        </div>
      </Section>

      <Section title={t('settings.pricing.title')} desc={t('settings.pricing.desc')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <Th>{t('settings.pricing.col.model')}</Th>
                <Th align="right">{t('settings.pricing.col.input')}</Th>
                <Th align="right">{t('settings.pricing.col.output')}</Th>
                <Th align="right">{t('settings.pricing.col.write5m')}</Th>
                <Th align="right">{t('settings.pricing.col.write1h')}</Th>
                <Th align="right">{t('settings.pricing.col.read')}</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(BUILTIN_PRICING).map(([model, p]) => (
                <tr key={model} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-text-primary">{shortenModel(model)}</td>
                  <td className="px-3 py-2 num-mono text-right">{formatUSD(p.input)}</td>
                  <td className="px-3 py-2 num-mono text-right">{formatUSD(p.output)}</td>
                  <td className="px-3 py-2 num-mono text-right text-text-secondary">{formatUSD(p.cacheCreation5m)}</td>
                  <td className="px-3 py-2 num-mono text-right text-text-secondary">{formatUSD(p.cacheCreation1h)}</td>
                  <td className="px-3 py-2 num-mono text-right text-success">{formatUSD(p.cacheRead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t('settings.about.title')} desc={t('settings.about.subtitle', { version: VERSION })}>
        <ul className="text-sm text-text-secondary space-y-1.5">
          <li>• {t('settings.about.line1')}</li>
          <li>• {t('settings.about.line2')}</li>
          <li>• {t('settings.about.line3')}</li>
          <li>• {t('settings.about.line4')}</li>
        </ul>
      </Section>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card-pad py-4">
      <div className="label">{label}</div>
      <div className="num-mid mt-1">{value}</div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-medium text-text-tertiary uppercase tracking-wide whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  );
}
