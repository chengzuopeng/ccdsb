import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateByProject } from '@/lib/aggregator';
import { resolveSource, filterBySource } from '@/lib/source';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = await resolveSource(url.searchParams.get('source'));
  const scan = await getCachedScan();
  const records = filterBySource(scan.records, source);
  const projects = aggregateByProject(records, { source });
  return NextResponse.json({ source, projects });
}
