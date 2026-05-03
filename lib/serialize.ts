import type { BlockProgressInfo } from './blocks/compute';
import type { AssistantRecord } from './types';
import { costOfRecord } from './pricing/calculate';

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
