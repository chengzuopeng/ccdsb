import type { BlockProgressInfo } from './blocks/compute';
import type { AssistantRecord, UserRecord } from './types';
import { costOfRecord } from './pricing/calculate';
import { buildTurnIndex } from './turns';

export interface SerializedProgress {
  hasBlock: boolean;
  startTime?: string;
  endTime?: string;
  totalTokens: number;
  cost: number;
  requests: number;
  models: string[];
  burnRatePerMin: number;
  costPerMin: number;
  projectedTotal: number;
  projectedCost: number;
}

export function blockToSerialized(info: BlockProgressInfo | null): SerializedProgress {
  if (!info || !info.block) {
    return {
      hasBlock: false,
      totalTokens: 0,
      cost: 0,
      requests: 0,
      models: [],
      burnRatePerMin: 0,
      costPerMin: 0,
      projectedTotal: 0,
      projectedCost: 0,
    };
  }
  return {
    hasBlock: true,
    startTime: info.block.startTime,
    endTime: info.block.endTime,
    totalTokens: info.block.totalTokens,
    cost: info.block.cost,
    requests: info.block.requests,
    models: info.block.models,
    burnRatePerMin: info.burnRatePerMin,
    costPerMin: info.costPerMin,
    projectedTotal: info.projectedTotal,
    projectedCost: info.projectedCost,
  };
}

export interface UsageTableRow {
  uuid: string;
  timestamp: string;
  model: string;
  cwd: string;
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number;
  toolNames: string[];
}

export function recordsToTableRows(records: AssistantRecord[]): UsageTableRow[] {
  return records.map((r) => ({
    uuid: r.uuid,
    timestamp: r.timestamp,
    model: r.model,
    cwd: r.cwd,
    sessionId: r.sessionId,
    inputTokens: r.usage.input_tokens,
    outputTokens: r.usage.output_tokens,
    cacheReadTokens: r.usage.cache_read_input_tokens,
    cacheCreationTokens: r.usage.cache_creation_input_tokens,
    cost: costOfRecord(r).total,
    toolNames: r.toolNames,
  }));
}

export interface UsageTurnRow {
  turnId: string;
  timestamp: string;
  endTimestamp: string;
  cwd: string;
  sessionId: string;
  models: string[];
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  cost: number;
  toolNames: string[];
  userText: string;
  children: UsageTableRow[];
}

export function recordsToTurnRows(
  assistants: AssistantRecord[],
  users: UserRecord[],
  parentMap: Record<string, string | null>,
): UsageTurnRow[] {
  const turnIndex = buildTurnIndex(assistants, users, parentMap);
  const userMap = new Map<string, UserRecord>();
  for (const u of users) userMap.set(u.uuid, u);

  const groups = new Map<string, UsageTableRow[]>();
  const order = new Map<string, AssistantRecord>();
  for (const r of assistants) {
    const turnId = turnIndex.get(r.uuid) ?? r.uuid;
    const child: UsageTableRow = {
      uuid: r.uuid,
      timestamp: r.timestamp,
      model: r.model,
      cwd: r.cwd,
      sessionId: r.sessionId,
      inputTokens: r.usage.input_tokens,
      outputTokens: r.usage.output_tokens,
      cacheReadTokens: r.usage.cache_read_input_tokens,
      cacheCreationTokens: r.usage.cache_creation_input_tokens,
      cost: costOfRecord(r).total,
      toolNames: r.toolNames,
    };
    const list = groups.get(turnId);
    if (list) list.push(child);
    else groups.set(turnId, [child]);
    if (!order.has(turnId)) order.set(turnId, r);
  }

  const turns: UsageTurnRow[] = [];
  for (const [turnId, children] of groups) {
    children.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
    const first = children[0];
    const last = children[children.length - 1];
    const modelSet = new Set<string>();
    const toolSet = new Set<string>();
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let cost = 0;
    for (const c of children) {
      modelSet.add(c.model);
      for (const t of c.toolNames) toolSet.add(t);
      inputTokens += c.inputTokens;
      outputTokens += c.outputTokens;
      cacheReadTokens += c.cacheReadTokens;
      cacheCreationTokens += c.cacheCreationTokens;
      cost += c.cost;
    }
    const userRec = userMap.get(turnId);
    turns.push({
      turnId,
      timestamp: first.timestamp,
      endTimestamp: last.timestamp,
      cwd: first.cwd,
      sessionId: first.sessionId,
      models: Array.from(modelSet),
      callCount: children.length,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      cost,
      toolNames: Array.from(toolSet),
      userText: userRec?.textPreview ?? '',
      children,
    });
  }
  turns.sort((a, b) => (a.endTimestamp < b.endTimestamp ? 1 : -1));
  return turns;
}
