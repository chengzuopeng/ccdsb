import type { AssistantRecord, UserRecord } from './types';

const MAX_PARENT_WALK = 5000;

export function buildTurnIndex(
  assistants: AssistantRecord[],
  users: UserRecord[],
  parentMap: Record<string, string | null>,
): Map<string, string> {
  const userTextMap = new Map<string, string>();
  for (const u of users) {
    // Synthetic user messages (skill metadata, system-reminders) still carry
    // text in textPreview so per-call displays can show them, but they must
    // not be treated as turn roots — that's what wrongly split conversations
    // in the usage table.
    if (u.isSynthetic) continue;
    if (u.textPreview && u.textPreview.trim()) userTextMap.set(u.uuid, u.textPreview);
  }

  const result = new Map<string, string>();
  const memo = new Map<string, string>();

  function resolve(startUuid: string): string {
    const path: string[] = [];
    let cur: string | null = startUuid;
    let answer: string | null = null;
    let steps = 0;
    const seen = new Set<string>();
    while (cur && steps++ < MAX_PARENT_WALK) {
      if (seen.has(cur)) break;
      seen.add(cur);
      const m = memo.get(cur);
      if (m) {
        answer = m;
        break;
      }
      path.push(cur);
      if (userTextMap.has(cur)) {
        answer = cur;
        break;
      }
      cur = parentMap[cur] ?? null;
    }
    if (!answer) answer = startUuid;
    for (const id of path) memo.set(id, answer);
    return answer;
  }

  for (const a of assistants) {
    result.set(a.uuid, resolve(a.uuid));
  }
  return result;
}
