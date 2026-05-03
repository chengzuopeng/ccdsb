import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import { aggregateBySession } from '@/lib/aggregator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const scan = await getCachedScan();
  const sessions = aggregateBySession(scan.records, scan.userRecords);
  return NextResponse.json({ sessions });
}
