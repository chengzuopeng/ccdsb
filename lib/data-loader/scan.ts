import { listProviders } from '../providers';
import type { ProviderId } from '../providers';
import type { ScanResult, ScanStatsBySource } from '../types';
import { indexer, type IndexerStatus } from './indexer';

export interface ScanResultExtended extends ScanResult {
  bySource: ScanStatsBySource[];
}

export async function getCachedScan(opts: { force?: boolean } = {}): Promise<ScanResultExtended> {
  if (opts.force) {
    return indexer.forceRescan();
  }
  await indexer.init();
  return indexer.getSnapshot();
}

export async function scanAll(opts: { force?: boolean } = {}): Promise<ScanResultExtended> {
  return getCachedScan(opts);
}

export function clearScanCache() {
  // No-op now. The indexer keeps its index up-to-date via watchers + polling.
  // Force-rescan happens via getCachedScan({ force: true }) or POST /api/scan.
}

export function getScannedDirs(): string[] {
  const out: string[] = [];
  for (const p of listProviders()) {
    out.push(...p.getDirs());
  }
  return Array.from(new Set(out));
}

export function getScannedDirsBySource(): Array<{ source: ProviderId; dirs: string[] }> {
  return listProviders().map((p) => ({ source: p.id, dirs: p.getDirs() }));
}

export function getIndexerStatus(): IndexerStatus {
  return indexer.getStatus();
}
