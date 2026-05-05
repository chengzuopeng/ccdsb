import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import {
  aggregateByModel,
  aggregateByProject,
  aggregateByTime,
  aggregateTotals,
  type Granularity,
} from '@/lib/aggregator';
import { rangeToDates } from '@/lib/range';
import { resolveSource, filterBySource } from '@/lib/source';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = await resolveSource(url.searchParams.get('source'));
  const range = url.searchParams.get('range') || 'all';
  const gran = (url.searchParams.get('gran') || 'day') as Granularity;
  const models = url.searchParams.get('models')?.split(',').filter(Boolean) ?? undefined;
  const projects = url.searchParams.get('projects')?.split(',').filter(Boolean) ?? undefined;
  const view = url.searchParams.get('view') || 'time';

  const dates = rangeToDates(range);
  const opts = { source, from: dates.from, to: dates.to, models, projects };

  const scan = await getCachedScan();
  const records = filterBySource(scan.records, source);
  if (view === 'time') {
    const buckets = aggregateByTime(records, gran, opts);
    return NextResponse.json({
      source,
      totals: aggregateTotals(records, opts),
      buckets,
    });
  }
  if (view === 'model') {
    return NextResponse.json({
      source,
      totals: aggregateTotals(records, opts),
      models: aggregateByModel(records, opts),
    });
  }
  if (view === 'project') {
    return NextResponse.json({
      source,
      totals: aggregateTotals(records, opts),
      projects: aggregateByProject(records, opts),
    });
  }
  return NextResponse.json({ error: 'invalid view' }, { status: 400 });
}
