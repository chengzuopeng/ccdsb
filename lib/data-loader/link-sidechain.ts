// Cross-file relink for Claude Code sub-agent sessions.
//
// Claude Code stores each sub-agent invocation as its own JSONL file under
//   ~/.claude/projects/<encoded-cwd>/<parent-session-uuid>/subagents/agent-*.jsonl
// All records inside that file carry `isSidechain: true`, share the parent
// session's `sessionId`, and chain via `parentUuid` *within the file* — but
// the first user record has `parentUuid: null`, breaking the link back to
// the parent agent's Task-calling assistant.
//
// `buildTurnIndex` walks `parentUuid` looking for a non-synthetic user as a
// turn root. With the link broken, the sub-agent's synthesised first user
// (already marked synthetic by the parser) has nowhere to walk, so its
// descendant assistants become their own turn — which is why the usage
// table shows the sub-agent prompt as a separate row.
//
// This module re-links by writing into the in-memory parent map:
//   parentMap[subagent.firstUser.uuid] = <parent session's nearest assistant
//                                          whose timestamp ≤ firstUser.ts>
//
// After re-linking, the walk goes:
//   subagent.A1  → subagent.firstUser  (synthetic, skip)
//                → parent.anchorA      → ... → parent.realUser  ✓
//
// Strictly mutation — no records are added/removed, only `parentMap` is
// updated. Safe to run repeatedly (idempotent given the same inputs).

import type { AssistantRecord, UserRecord } from '../types';

/**
 * Path layout of a Claude Code sub-agent file:
 *   .../<encoded-cwd>/<parent-session-uuid>/subagents/agent-<id>.jsonl
 * The capture group is the parent session UUID.
 */
const SUBAGENT_FILE_PATTERN = /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/subagents\/agent-[^/]+\.jsonl$/i;

export function extractParentSessionFromSubagentPath(filePath: string): string | null {
  const m = SUBAGENT_FILE_PATTERN.exec(filePath);
  return m ? m[1] : null;
}

interface LinkInputs {
  assistantRecords: AssistantRecord[];
  userRecords: UserRecord[];
  parentMap: Record<string, string | null>;
}

export interface LinkSidechainStats {
  /** Number of sub-agent files (== distinct file paths) considered. */
  subagentFiles: number;
  /** Of those, how many had a usable parent assistant and got re-linked. */
  relinked: number;
  /** Files where the parent session had no records on disk. */
  orphans: number;
  /** Files where the first user record's parentUuid was already non-null
   *  (already linked — typically by a previous pass). Counted but skipped. */
  alreadyLinked: number;
}

/**
 * Re-link sub-agent first-user records to their parent session's nearest
 * prior assistant. Mutates `parentMap` in place.
 *
 * @returns stats for telemetry / debug; never throws.
 */
export function linkSidechainParents({
  assistantRecords,
  userRecords,
  parentMap,
}: LinkInputs): LinkSidechainStats {
  // Index non-sidechain assistants by sessionId so we can pick a parent
  // anchor without scanning every record per sub-agent file. Excluding
  // sidechain assistants prevents nested sub-agents from anchoring onto
  // each other (we deliberately defer nested handling — see plan).
  const parentAssistantsBySession = new Map<string, AssistantRecord[]>();
  for (const a of assistantRecords) {
    if (a.isSidechain) continue;
    if (!a.sessionId) continue;
    let list = parentAssistantsBySession.get(a.sessionId);
    if (!list) {
      list = [];
      parentAssistantsBySession.set(a.sessionId, list);
    }
    list.push(a);
  }
  // Sort each per-session list by timestamp ascending for binary-search-style
  // upper-bound lookup. ISO 8601 sorts correctly as a string.
  for (const list of parentAssistantsBySession.values()) {
    list.sort((x, y) => (x.timestamp < y.timestamp ? -1 : x.timestamp > y.timestamp ? 1 : 0));
  }

  // Group sidechain user records by file so we only relink the first one
  // per file (the synthesised prompt). Subsequent users inside the same
  // sub-agent file are real intra-subagent messages with valid parent
  // chains — leave them alone.
  const firstSidechainUserByFile = new Map<string, UserRecord>();
  for (const u of userRecords) {
    if (!u.isSidechain) continue;
    const existing = firstSidechainUserByFile.get(u.filePath);
    if (!existing || u.timestamp < existing.timestamp) {
      firstSidechainUserByFile.set(u.filePath, u);
    }
  }

  const stats: LinkSidechainStats = {
    subagentFiles: 0,
    relinked: 0,
    orphans: 0,
    alreadyLinked: 0,
  };

  for (const [filePath, firstUser] of firstSidechainUserByFile) {
    const parentSessionId = extractParentSessionFromSubagentPath(filePath);
    if (!parentSessionId) continue; // not a standard sub-agent path
    stats.subagentFiles += 1;

    // Skip if a prior pass already linked it to a real parent (idempotency).
    const existingParent = parentMap[firstUser.uuid];
    if (existingParent !== null && existingParent !== undefined) {
      stats.alreadyLinked += 1;
      continue;
    }

    const parentAssistants = parentAssistantsBySession.get(parentSessionId);
    if (!parentAssistants || parentAssistants.length === 0) {
      stats.orphans += 1;
      continue;
    }

    // Find the latest parent assistant with timestamp ≤ firstUser.timestamp.
    // Linear scan from the end — typically fast since sub-agent timestamps
    // are near the end of the parent session.
    const t0 = firstUser.timestamp;
    let anchor: AssistantRecord | undefined;
    for (let i = parentAssistants.length - 1; i >= 0; i -= 1) {
      if (parentAssistants[i].timestamp <= t0) {
        anchor = parentAssistants[i];
        break;
      }
    }
    // Clock-skew fallback: sub-agent's first user predates every parent
    // assistant. Use the earliest one — guarantees the sub-agent lands
    // in *some* turn of the right session instead of being orphaned.
    if (!anchor) anchor = parentAssistants[0];

    parentMap[firstUser.uuid] = anchor.uuid;
    stats.relinked += 1;
  }

  return stats;
}
