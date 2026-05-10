import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import {
  aggregateByModel,
  aggregateByProject,
  aggregateByTime,
  aggregateTotals,
  isGranularity,
} from '@/lib/aggregator';
import { isUsageRange, rangeToDates } from '@/lib/range';
import { resolveSource, filterBySource } from '@/lib/source';
import { badRequest, withApiErrorHandling } from '@/lib/api/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const source = await resolveSource(url.searchParams.get('source'));
  const rangeRaw = url.searchParams.get('range') || 'all';
  if (!isUsageRange(rangeRaw)) {
    return badRequest(`invalid range: ${rangeRaw}`, 'invalid_range');
  }
  const range = rangeRaw;
  const granRaw = url.searchParams.get('gran') || 'day';
  if (!isGranularity(granRaw)) {
    return badRequest(`invalid granularity: ${granRaw}`, 'invalid_granularity');
  }
  const gran = granRaw;
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
});
