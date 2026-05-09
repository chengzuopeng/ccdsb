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
  /** Subset of outputTokens. Display-only; not double-counted in totals/cost. */
  reasoningTokens: number;
  totalTokens: number;
  cost: number;
  costInput: number;
  costOutput: number;
  costCacheRead: number;
  costCacheWrite: number;
  toolNames: string[];
  /** Provider-specific reasoning depth (Codex: low/medium/high/minimal). */
  effort?: string;
}

export function recordsToTableRows(records: AssistantRecord[]): UsageTableRow[] {
  return records.map((r) => {
    const c = costOfRecord(r);
    return {
      uuid: r.uuid,
      timestamp: r.timestamp,
      model: r.model,
      cwd: r.cwd,
      sessionId: r.sessionId,
      inputTokens: r.usage.input_tokens,
      outputTokens: r.usage.output_tokens,
      cacheReadTokens: r.usage.cache_read_input_tokens,
      cacheCreationTokens: r.usage.cache_creation_input_tokens,
      reasoningTokens: r.usage.reasoning_tokens ?? 0,
      totalTokens:
        r.usage.input_tokens +
        r.usage.output_tokens +
        r.usage.cache_read_input_tokens +
        r.usage.cache_creation_input_tokens,
      cost: c.total,
      costInput: c.input,
      costOutput: c.output,
      costCacheRead: c.cacheRead,
      costCacheWrite: c.cacheCreation5m + c.cacheCreation1h,
      toolNames: r.toolNames,
      effort: r.effort,
    };
  });
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
  /** Sum of children reasoningTokens. Subset of outputTokens. */
  reasoningTokens: number;
  totalTokens: number;
  cost: number;
  costInput: number;
  costOutput: number;
  costCacheRead: number;
  costCacheWrite: number;
  toolNames: string[];
  /** Distinct effort levels seen across children (empty if none reported). */
  efforts: string[];
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
    const c = costOfRecord(r);
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
      reasoningTokens: r.usage.reasoning_tokens ?? 0,
      totalTokens:
        r.usage.input_tokens +
        r.usage.output_tokens +
        r.usage.cache_read_input_tokens +
        r.usage.cache_creation_input_tokens,
      cost: c.total,
      costInput: c.input,
      costOutput: c.output,
      costCacheRead: c.cacheRead,
      costCacheWrite: c.cacheCreation5m + c.cacheCreation1h,
      toolNames: r.toolNames,
      effort: r.effort,
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
    const effortSet = new Set<string>();
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    let reasoningTokens = 0;
    let cost = 0;
    let costInput = 0;
    let costOutput = 0;
    let costCacheRead = 0;
    let costCacheWrite = 0;
    for (const c of children) {
      modelSet.add(c.model);
      for (const t of c.toolNames) toolSet.add(t);
      if (c.effort) effortSet.add(c.effort);
      inputTokens += c.inputTokens;
      outputTokens += c.outputTokens;
      cacheReadTokens += c.cacheReadTokens;
      cacheCreationTokens += c.cacheCreationTokens;
      reasoningTokens += c.reasoningTokens;
      cost += c.cost;
      costInput += c.costInput;
      costOutput += c.costOutput;
      costCacheRead += c.costCacheRead;
      costCacheWrite += c.costCacheWrite;
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
      reasoningTokens,
      totalTokens: inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
      cost,
      costInput,
      costOutput,
      costCacheRead,
      costCacheWrite,
      toolNames: Array.from(toolSet),
      efforts: Array.from(effortSet),
      userText: userRec?.textPreview ?? '',
      children,
    });
  }
  turns.sort((a, b) => (a.endTimestamp < b.endTimestamp ? 1 : -1));
  return turns;
}
