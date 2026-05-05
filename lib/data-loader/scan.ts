import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dedupAssistantRecords } from '../dedup';
import { listProviders } from '../providers';
import type { ProviderAdapter, ProviderId } from '../providers';
import type { AssistantRecord, ScanResult, ScanStats, ScanStatsBySource, UserRecord } from '../types';

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await fs.stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function listJsonlFiles(rootDir: string, provider: ProviderAdapter): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 8) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (provider.shouldSkipDir(e.name)) continue;
        await walk(full, depth + 1);
      } else if (e.isFile() && e.name.endsWith('.jsonl')) {
        out.push(full);
      }
    }
  }

  await walk(rootDir, 0);
  return out;
}

interface CacheEntry {
  source: ProviderId;
  mtimeMs: number;
  size: number;
  assistantRecords: AssistantRecord[];
  userRecords: UserRecord[];
  parentLinks: Array<[string, string | null]>;
}

const fileCache = new Map<string, CacheEntry>();

interface ScanResultExtended extends ScanResult {
  bySource: ScanStatsBySource[];
}

export async function scanAll(opts: { force?: boolean } = {}): Promise<ScanResultExtended> {
  const start = Date.now();
  const providers = listProviders();
  const existingDirs: string[] = [];
  type FileEntry = { file: string; provider: ProviderAdapter };
  const fileEntries: FileEntry[] = [];

  const bySourceState: Record<ProviderId, ScanStatsBySource> = {
    claude: { source: 'claude', filesScanned: 0, recordsParsed: 0, assistantRecords: 0, scannedDirs: [] },
    codex: { source: 'codex', filesScanned: 0, recordsParsed: 0, assistantRecords: 0, scannedDirs: [] },
  };

  for (const provider of providers) {
    for (const d of provider.getDirs()) {
      if (await dirExists(d)) {
        existingDirs.push(d);
        bySourceState[provider.id].scannedDirs.push(d);
        const files = await listJsonlFiles(d, provider);
        for (const f of files) fileEntries.push({ file: f, provider });
      }
    }
  }

  const assistantRecords: AssistantRecord[] = [];
  const userRecords: UserRecord[] = [];
  const parentMap: Record<string, string | null> = {};
  let recordsParsed = 0;

  await Promise.all(
    fileEntries.map(async ({ file, provider }) => {
      try {
        const stat = await fs.stat(file);
        const cached = fileCache.get(file);
        if (
          !opts.force &&
          cached &&
          cached.source === provider.id &&
          cached.mtimeMs === stat.mtimeMs &&
          cached.size === stat.size
        ) {
          assistantRecords.push(...cached.assistantRecords);
          userRecords.push(...cached.userRecords);
          for (const [uuid, parent] of cached.parentLinks) parentMap[uuid] = parent;
          recordsParsed += cached.assistantRecords.length + cached.userRecords.length;
          bySourceState[provider.id].filesScanned += 1;
          bySourceState[provider.id].recordsParsed += cached.assistantRecords.length + cached.userRecords.length;
          bySourceState[provider.id].assistantRecords += cached.assistantRecords.length;
          return;
        }
        const parsed = await provider.parseFile(file);
        fileCache.set(file, {
          source: provider.id,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          assistantRecords: parsed.assistant,
          userRecords: parsed.user,
          parentLinks: parsed.parentLinks,
        });
        assistantRecords.push(...parsed.assistant);
        userRecords.push(...parsed.user);
        for (const [uuid, parent] of parsed.parentLinks) parentMap[uuid] = parent;
        recordsParsed += parsed.assistant.length + parsed.user.length;
        bySourceState[provider.id].filesScanned += 1;
        bySourceState[provider.id].recordsParsed += parsed.assistant.length + parsed.user.length;
        bySourceState[provider.id].assistantRecords += parsed.assistant.length;
      } catch (err) {
        console.error(`[ccgauge] failed to parse ${file}:`, err);
      }
    }),
  );

  const dedupedAssistants = dedupAssistantRecords(assistantRecords).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  const dedupedUsers = dedupUserRecords(userRecords).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  for (const sourceStat of Object.values(bySourceState)) {
    sourceStat.assistantRecords = 0;
  }
  for (const rec of dedupedAssistants) {
    bySourceState[rec.source].assistantRecords += 1;
  }

  const stats: ScanStats = {
    filesScanned: fileEntries.length,
    recordsParsed,
    assistantRecords: dedupedAssistants.length,
    durationMs: Date.now() - start,
    scannedDirs: existingDirs,
  };

  return {
    records: dedupedAssistants,
    userRecords: dedupedUsers,
    parentMap,
    stats,
    bySource: Object.values(bySourceState),
  };
}

function dedupUserRecords(records: UserRecord[]): UserRecord[] {
  const seen = new Set<string>();
  return records.filter((r) => {
    const k = r.uuid;
    if (!k) return true;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

let cachedScan: { promise: Promise<ScanResultExtended>; t: number } | null = null;
const SCAN_TTL_MS = 5_000;

export async function getCachedScan(opts: { force?: boolean } = {}): Promise<ScanResultExtended> {
  if (opts.force) {
    cachedScan = null;
  }
  const now = Date.now();
  if (cachedScan && now - cachedScan.t < SCAN_TTL_MS) {
    return cachedScan.promise;
  }
  const promise = scanAll(opts);
  cachedScan = { promise, t: now };
  return promise;
}

export function clearScanCache() {
  cachedScan = null;
  fileCache.clear();
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
