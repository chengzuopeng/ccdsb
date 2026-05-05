import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { AssistantRecord, ProviderId, UserRecord } from '../types';

// v2: added per-entry parserVersion so a parser semantic change auto-invalidates
// stale records without requiring users to delete ~/.ccgauge by hand.
const SCHEMA_VERSION = 2;

export interface PersistedFileEntry {
  filePath: string;
  source: ProviderId;
  /** Provider's parserVersion when these records were produced. If it no
   *  longer matches the current adapter, the file is re-parsed on startup. */
  parserVersion: string;
  mtimeMs: number;
  size: number;
  assistantRecords: AssistantRecord[];
  userRecords: UserRecord[];
  parentLinks: Array<[string, string | null]>;
}

interface PersistedIndex {
  schemaVersion: number;
  savedAt: string;
  files: PersistedFileEntry[];
}

function getStateDir(): string {
  if (process.env.CCGAUGE_STATE_DIR) return process.env.CCGAUGE_STATE_DIR;
  return path.join(os.homedir(), '.ccgauge');
}

function getIndexPath(): string {
  return path.join(getStateDir(), 'cache', `index-v${SCHEMA_VERSION}.json`);
}

export async function loadPersistedIndex(): Promise<PersistedIndex | null> {
  const filePath = getIndexPath();
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as PersistedIndex;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    if (!Array.isArray(parsed.files)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function savePersistedIndex(payload: {
  savedAt: string;
  files: PersistedFileEntry[];
}): Promise<void> {
  const filePath = getIndexPath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const data: PersistedIndex = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: payload.savedAt,
    files: payload.files,
  };
  const tmp = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(data));
  await fs.rename(tmp, filePath);
}

export async function clearPersistedIndex(): Promise<void> {
  try {
    await fs.unlink(getIndexPath());
  } catch {
    // ignore
  }
}
