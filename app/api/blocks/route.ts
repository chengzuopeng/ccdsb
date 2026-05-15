import { NextResponse } from 'next/server';
import { getCachedScan } from '@/lib/data-loader/scan';
import { blockProgress, computeBlocks } from '@/lib/blocks/compute';
import { resolveSource, filterBySource, expandSources } from '@/lib/source';
import { getProvider } from '@/lib/providers';
import { withApiErrorHandling } from '@/lib/api/error-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async (req: Request) => {
  const url = new URL(req.url);
  const source = await resolveSource(url.searchParams.get('source'));
  const scan = await getCachedScan();
  const sources = expandSources(source);

  // For 'all' we return a per-source map instead of merging — each
  // provider has its own rate-limit window and merging tokens across them
  // wouldn't reflect either actual budget. Same shape semantics as the
  // single-source path, just keyed by provider.
  const bySource = sources.map((s) => {
    const records = filterBySource(scan.records, s);
    const windowMs = getProvider(s).capabilities.blockWindowMs;
    return {
      source: s,
      windowMs,
      blocks: computeBlocks(records, windowMs),
      progress: blockProgress(records, windowMs),
    };
  });

  if (source === 'all') {
    return NextResponse.json({ source, bySource });
  }
  const only = bySource[0];
  return NextResponse.json({
    source,
    windowMs: only.windowMs,
    blocks: only.blocks,
    progress: only.progress,
  });
});
