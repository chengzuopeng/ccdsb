import { BUILTIN_PRICING, FALLBACK_BY_FAMILY } from './builtin';
import type { Pricing } from '../types';

export interface PricingResolution {
  pricing: Pricing | null;
  source: 'exact' | 'date-stripped' | 'prefix-stripped' | 'family-fallback' | 'none';
  matchedKey: string | null;
}

const dateSuffix = /-\d{8}$/;
const prefixRe = /^(vertex_ai|bedrock|anthropic)\//;

export function resolvePricing(model: string): PricingResolution {
  if (!model) return { pricing: null, source: 'none', matchedKey: null };
  if (BUILTIN_PRICING[model]) {
    return { pricing: BUILTIN_PRICING[model], source: 'exact', matchedKey: model };
  }
  const stripped = model.replace(dateSuffix, '');
  if (BUILTIN_PRICING[stripped]) {
    return { pricing: BUILTIN_PRICING[stripped], source: 'date-stripped', matchedKey: stripped };
  }
  const noPrefix = stripped.replace(prefixRe, '');
  if (BUILTIN_PRICING[noPrefix]) {
    return {
      pricing: BUILTIN_PRICING[noPrefix],
      source: 'prefix-stripped',
      matchedKey: noPrefix,
    };
  }
  for (const family of ['opus', 'sonnet', 'haiku']) {
    if (model.toLowerCase().includes(family)) {
      return {
        pricing: FALLBACK_BY_FAMILY[family],
        source: 'family-fallback',
        matchedKey: `claude-${family}-(latest)`,
      };
    }
  }
  return { pricing: null, source: 'none', matchedKey: null };
}
