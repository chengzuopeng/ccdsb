import type { AssistantRecord } from './types';

export function dedupKey(r: AssistantRecord): string {
  if (r.messageId && r.requestId) return `${r.messageId}::${r.requestId}`;
  if (r.messageId) return `mid:${r.messageId}`;
  if (r.requestId) return `req:${r.requestId}`;
  return `uuid:${r.uuid}`;
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
