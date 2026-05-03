import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateByProject } from '@/lib/aggregator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const scan = await getCachedScan();
  const projects = aggregateByProject(scan.records);
  return NextResponse.json({ projects });
}
