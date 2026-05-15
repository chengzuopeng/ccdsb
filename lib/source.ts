import { cookies } from 'next/headers';
import {
  ALL_PROVIDER_IDS,
  coerceProviderId,
  DEFAULT_PROVIDER,
  detectAvailableProviders,
  isProviderId,
} from './providers';
import type { ProviderId } from './providers';

export const SOURCE_COOKIE = 'ccgauge_source';

/** What a page / API route gets after resolving the user's source filter.
 *  `'all'` is only valid when both providers are present on disk; the
 *  resolver downgrades it otherwise. */
export type EffectiveSource = ProviderId | 'all';

export function isEffectiveSource(v: unknown): v is EffectiveSource {
  return v === 'all' || isProviderId(v);
}

export function parseSourceParam(v: string | null | undefined): EffectiveSource {
  if (v === 'all') return 'all';
  return coerceProviderId(v);
}

/** Resolve effective source for a server component / API route.
 *  Precedence: explicit URL searchParam > cookie > default.
 *
 *  `'all'` is preserved only when both providers are actually present on
 *  the host. If the user has only one provider, `'all'` collapses to the
 *  available single provider — never crash, never silently show empty. */
export async function resolveSource(searchParam?: string | null): Promise<EffectiveSource> {
  const available = await detectAvailableProviders();
  const canBeAll = available.length >= 2;

  const fromUrl = searchParam ?? undefined;
  if (fromUrl === 'all' && canBeAll) return 'all';
  if (fromUrl && isProviderId(fromUrl)) return fromUrl;

  const c = await cookies();
  const cookieVal = c.get(SOURCE_COOKIE)?.value;
  if (cookieVal === 'all' && canBeAll) return 'all';
  const preferred = cookieVal && isProviderId(cookieVal) ? cookieVal : DEFAULT_PROVIDER;

  if (available.length > 0 && !available.includes(preferred)) return available[0];
  return preferred;
}

/** Filter records to the chosen source. `'all'` is a pass-through. */
export function filterBySource<T extends { source: ProviderId }>(
  records: T[],
  source: EffectiveSource,
): T[] {
  if (source === 'all') return records;
  return records.filter((r) => r.source === source);
}

/** Expand to the concrete provider list. Used to dispatch aggregator calls
 *  one-per-source when `source` is `'all'`. */
export function expandSources(source: EffectiveSource): ProviderId[] {
  if (source === 'all') return ALL_PROVIDER_IDS.slice();
  return [source];
}
