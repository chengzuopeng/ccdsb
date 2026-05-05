import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import { blockProgress, computeBlocks } from '@/lib/blocks/compute';
import { resolveSource, filterBySource } from '@/lib/source';
import { getProvider } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = await resolveSource(url.searchParams.get('source'));
  const scan = await getCachedScan();
  const records = filterBySource(scan.records, source);
  const windowMs = getProvider(source).capabilities.blockWindowMs;
  const blocks = computeBlocks(records, windowMs);
  const progress = blockProgress(records, windowMs);
  return NextResponse.json({ source, blocks, progress, windowMs });
}
