import type { AssistantRecord, CostBreakdown, Pricing } from '../types';
import { resolvePricing } from './resolve';

const PER_MTOK = 1e6;

export function costFromUsage(
  usage: AssistantRecord['usage'],
  pricing: Pricing | null,
): CostBreakdown {
  if (!pricing) {
    return {
      input: 0,
      output: 0,
      cacheCreation5m: 0,
      cacheCreation1h: 0,
      cacheRead: 0,
      total: 0,
      saved: 0,
    };
  }

  const input = (usage.input_tokens / PER_MTOK) * pricing.input;
  const output = (usage.output_tokens / PER_MTOK) * pricing.output;

  let cc5 = (usage.cache_creation_5m / PER_MTOK) * pricing.cacheCreation5m;
  let cc1 = (usage.cache_creation_1h / PER_MTOK) * pricing.cacheCreation1h;

  if (cc5 + cc1 === 0 && usage.cache_creation_input_tokens > 0) {
    cc5 = (usage.cache_creation_input_tokens / PER_MTOK) * pricing.cacheCreation5m;
  }

  const cacheRead = (usage.cache_read_input_tokens / PER_MTOK) * pricing.cacheRead;
  const total = input + output + cc5 + cc1 + cacheRead;
  const saved = (usage.cache_read_input_tokens / PER_MTOK) * (pricing.input - pricing.cacheRead);

  return {
    input,
    output,
    cacheCreation5m: cc5,
    cacheCreation1h: cc1,
    cacheRead,
    total,
    saved,
  };
}

export function costOfRecord(rec: AssistantRecord): CostBreakdown {
  const { pricing } = resolvePricing(rec.model);
  return costFromUsage(rec.usage, pricing);
}

export function totalTokens(usage: AssistantRecord['usage']): number {
  return (
    usage.input_tokens +
    usage.output_tokens +
    usage.cache_creation_input_tokens +
    usage.cache_read_input_tokens
  );
}
