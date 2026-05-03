import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import { blockProgress, computeBlocks } from '@/lib/blocks/compute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const scan = await getCachedScan();
  const blocks = computeBlocks(scan.records);
  const progress = blockProgress(scan.records);
  return NextResponse.json({ blocks, progress });
}
