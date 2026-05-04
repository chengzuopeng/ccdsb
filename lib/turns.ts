import type { AssistantRecord, UserRecord } from './types';

const MAX_PARENT_WALK = 2000;

export function buildTurnIndex(
  assistants: AssistantRecord[],
  users: UserRecord[],
): Map<string, string> {
  const userMap = new Map<string, UserRecord>();
  for (const u of users) userMap.set(u.uuid, u);
  const asstMap = new Map<string, AssistantRecord>();
  for (const a of assistants) asstMap.set(a.uuid, a);

  const result = new Map<string, string>();
  const memo = new Map<string, string>();

  function resolve(startUuid: string): string {
    const cached = memo.get(startUuid);
    if (cached) return cached;
    const path: string[] = [];
    let cur: string | null = startUuid;
    let answer: string | null = null;
    let steps = 0;
    while (cur && steps++ < MAX_PARENT_WALK) {
      const m = memo.get(cur);
      if (m) {
        answer = m;
        break;
      }
      path.push(cur);
      const u = userMap.get(cur);
      if (u && u.textPreview && u.textPreview.trim()) {
        answer = cur;
        break;
      }
      const parent: string | null =
        u?.parentUuid ?? asstMap.get(cur)?.parentUuid ?? null;
      cur = parent;
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
