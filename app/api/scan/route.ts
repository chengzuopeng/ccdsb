import { NextResponse } from 'next/server';
import { getCachedScan, getIndexerStatus } from '@/lib/data-loader/scan';
import { detectAvailableProviders } from '@/lib/providers';
import { withApiErrorHandling } from '@/lib/api/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withApiErrorHandling(async () => {
  const result = await getCachedScan({ force: true });
  const available = await detectAvailableProviders();
  return NextResponse.json({
    ok: true,
    stats: result.stats,
    bySource: result.bySource,
    availableProviders: available,
    indexer: getIndexerStatus(),
  });
});

export const GET = withApiErrorHandling(async () => {
  const result = await getCachedScan();
  const available = await detectAvailableProviders();
  return NextResponse.json({
    ok: true,
    stats: result.stats,
    bySource: result.bySource,
    availableProviders: available,
    indexer: getIndexerStatus(),
  });
});
