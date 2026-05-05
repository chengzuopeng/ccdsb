import { NextResponse } from 'next/server';
import { clearScanCache, getCachedScan } from '@/lib/data-loader/scan';
import { detectAvailableProviders } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  clearScanCache();
  const result = await getCachedScan({ force: true });
  const available = await detectAvailableProviders();
  return NextResponse.json({
    ok: true,
    stats: result.stats,
    bySource: result.bySource,
    availableProviders: available,
  });
}

export async function GET() {
  const result = await getCachedScan();
  const available = await detectAvailableProviders();
  return NextResponse.json({
    ok: true,
    stats: result.stats,
    bySource: result.bySource,
    availableProviders: available,
  });
}
