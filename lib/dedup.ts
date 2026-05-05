import type { AssistantRecord } from './types';

export function dedupKey(r: AssistantRecord): string {
  const prefix = `${r.source}:`;
  if (r.messageId && r.requestId) return `${prefix}${r.messageId}::${r.requestId}`;
  if (r.messageId) return `${prefix}mid:${r.messageId}`;
  if (r.requestId) return `${prefix}req:${r.requestId}`;
  return `${prefix}uuid:${r.uuid}`;
}

export function dedupAssistantRecords(records: AssistantRecord[]): AssistantRecord[] {
  const seen = new Map<string, AssistantRecord>();
  for (const r of records) {
    const k = dedupKey(r);
    const existing = seen.get(k);
    if (!existing) {
      seen.set(k, r);
      continue;
    }
    if (r.timestamp < existing.timestamp) {
      seen.set(k, r);
    }
  }
  return Array.from(seen.values());
}
