import type { AssistantRecord, BlockSummary } from '../types';
import { costOfRecord } from '../pricing/calculate';

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

export function computeBlocks(records: AssistantRecord[]): BlockSummary[] {
  if (records.length === 0) return [];
  const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const blocks: BlockSummary[] = [];
  let current: BlockSummary | null = null;
  let blockStartMs = 0;
  const now = Date.now();

  for (const rec of sorted) {
    const t = new Date(rec.timestamp).getTime();
    if (!current || t - blockStartMs >= FIVE_HOURS_MS) {
      blockStartMs = t;
      current = {
        id: rec.timestamp,
        startTime: rec.timestamp,
        endTime: new Date(t + FIVE_HOURS_MS).toISOString(),
        actualEndTime: rec.timestamp,
        isActive: false,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: 0,
        cost: 0,
        saved: 0,
        models: [],
        requests: 0,
      };
      blocks.push(current);
    }
    const cost = costOfRecord(rec);
    current.inputTokens += rec.usage.input_tokens;
    current.outputTokens += rec.usage.output_tokens;
    current.cacheReadTokens += rec.usage.cache_read_input_tokens;
    current.cacheCreationTokens += rec.usage.cache_creation_input_tokens;
    current.totalTokens =
      current.inputTokens +
      current.outputTokens +
      current.cacheReadTokens +
      current.cacheCreationTokens;
    current.cost += cost.total;
    current.saved += cost.saved;
    current.requests += 1;
    current.actualEndTime = rec.timestamp;
    if (!current.models.includes(rec.model)) current.models.push(rec.model);
  }

  for (const b of blocks) {
    const endMs = new Date(b.endTime).getTime();
    b.isActive = now < endMs;
  }

  return blocks;
}

export function getActiveBlock(records: AssistantRecord[]): BlockSummary | null {
  const blocks = computeBlocks(records);
  const active = blocks.find((b) => b.isActive);
  return active ?? null;
}

export interface BlockProgressInfo {
  block: BlockSummary | null;
  elapsedMs: number;
  remainingMs: number;
  progress: number;
  burnRatePerMin: number;
  costPerMin: number;
  projectedTotal: number;
  projectedCost: number;
}

export function blockProgress(records: AssistantRecord[]): BlockProgressInfo {
  const block = getActiveBlock(records);
  if (!block) {
    return {
      block: null,
      elapsedMs: 0,
      remainingMs: 0,
      progress: 0,
      burnRatePerMin: 0,
      costPerMin: 0,
      projectedTotal: 0,
      projectedCost: 0,
    };
  }
  const now = Date.now();
  const startMs = new Date(block.startTime).getTime();
  const endMs = new Date(block.endTime).getTime();
  const elapsedMs = now - startMs;
  const remainingMs = Math.max(0, endMs - now);
  const progress = Math.min(1, elapsedMs / (5 * 60 * 60 * 1000));
  const elapsedMin = elapsedMs / 60_000;
  const burnRatePerMin = elapsedMin > 0 ? block.totalTokens / elapsedMin : 0;
  const costPerMin = elapsedMin > 0 ? block.cost / elapsedMin : 0;
  const totalMin = (5 * 60 * 60 * 1000) / 60_000;
  return {
    block,
    elapsedMs,
    remainingMs,
    progress,
    burnRatePerMin,
    costPerMin,
    projectedTotal: burnRatePerMin * totalMin,
    projectedCost: costPerMin * totalMin,
  };
}
