import { NextResponse } from 'next/server';
import { clearScanCache, getCachedScan } from '@/lib/data-loader/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  clearScanCache();
  const result = await getCachedScan({ force: true });
  return NextResponse.json({
    ok: true,
    stats: result.stats,
  });
}

export async function GET() {
  const result = await getCachedScan();
  return NextResponse.json({ ok: true, stats: result.stats });
}
