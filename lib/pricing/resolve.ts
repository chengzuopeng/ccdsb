import { getProvider, DEFAULT_PROVIDER } from '../providers';
import type { ProviderId, PricingResolution } from '../providers';

export type { PricingResolution };

export function resolvePricing(
  model: string,
  source: ProviderId = DEFAULT_PROVIDER,
): PricingResolution {
  return getProvider(source).resolvePricing(model);
}
