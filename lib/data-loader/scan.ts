import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { parseJsonlFile } from './parse-jsonl';
import { dedupAssistantRecords } from '../dedup';
import type { AssistantRecord, ScanResult, ScanStats, UserRecord } from '../types';

function getScanDirs(): string[] {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.claude', 'projects'),
    path.join(home, '.config', 'claude', 'projects'),
  ];

  if (process.env.CCDSB_CONFIG_DIR) {
    candidates.push(path.join(process.env.CCDSB_CONFIG_DIR, 'projects'));
  }
  if (process.env.CLAUDE_CONFIG_DIR) {
    candidates.push(path.join(process.env.CLAUDE_CONFIG_DIR, 'projects'));
  }

  return Array.from(new Set(candidates));
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await fs.stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function listJsonlFiles(rootDir: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 6) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'tool-results' || e.name === 'memory') continue;
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
  mtimeMs: number;
  size: number;
  assistantRecords: AssistantRecord[];
  userRecords: UserRecord[];
}

const fileCache = new Map<string, CacheEntry>();

export async function scanAll(opts: { force?: boolean } = {}): Promise<ScanResult> {
  const start = Date.now();
  const dirs = getScanDirs();
  const existingDirs: string[] = [];
  const fileList: string[] = [];

  for (const d of dirs) {
    if (await dirExists(d)) {
      existingDirs.push(d);
      const files = await listJsonlFiles(d);
      fileList.push(...files);
    }
  }

  const assistantRecords: AssistantRecord[] = [];
  const userRecords: UserRecord[] = [];
  let recordsParsed = 0;

  await Promise.all(
    fileList.map(async (file) => {
      try {
        const stat = await fs.stat(file);
        const cached = fileCache.get(file);
        if (
          !opts.force &&
          cached &&
          cached.mtimeMs === stat.mtimeMs &&
          cached.size === stat.size
        ) {
          assistantRecords.push(...cached.assistantRecords);
          userRecords.push(...cached.userRecords);
          recordsParsed += cached.assistantRecords.length + cached.userRecords.length;
          return;
        }
        const parsed = await parseJsonlFile(file);
        fileCache.set(file, {
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          assistantRecords: parsed.assistant,
          userRecords: parsed.user,
        });
        assistantRecords.push(...parsed.assistant);
        userRecords.push(...parsed.user);
        recordsParsed += parsed.assistant.length + parsed.user.length;
      } catch (err) {
        console.error(`[ccdsb] failed to parse ${file}:`, err);
      }
    }),
  );

  const dedupedAssistants = dedupAssistantRecords(assistantRecords).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  const dedupedUsers = dedupUserRecords(userRecords).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  const stats: ScanStats = {
    filesScanned: fileList.length,
    recordsParsed,
    assistantRecords: dedupedAssistants.length,
    durationMs: Date.now() - start,
    scannedDirs: existingDirs,
  };

  return { records: dedupedAssistants, userRecords: dedupedUsers, stats };
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

let cachedScan: { promise: Promise<ScanResult>; t: number } | null = null;
const SCAN_TTL_MS = 5_000;

export async function getCachedScan(opts: { force?: boolean } = {}): Promise<ScanResult> {
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
  return getScanDirs();
}
