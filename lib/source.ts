import { cookies } from 'next/headers';
import { coerceProviderId, DEFAULT_PROVIDER, detectAvailableProviders, isProviderId } from './providers';
import type { ProviderId } from './providers';

export const SOURCE_COOKIE = 'ccgauge_source';

export function parseSourceParam(v: string | null | undefined): ProviderId {
  return coerceProviderId(v);
}

/** Resolve effective source for a server component / API route.
 *  Precedence: explicit URL searchParam > cookie > default. */
export async function resolveSource(searchParam?: string | null): Promise<ProviderId> {
  if (searchParam && isProviderId(searchParam)) return searchParam;
  const c = await cookies();
  const cookieVal = c.get(SOURCE_COOKIE)?.value;
  const preferred = cookieVal && isProviderId(cookieVal) ? cookieVal : DEFAULT_PROVIDER;
  const available = await detectAvailableProviders();
  if (available.length > 0 && !available.includes(preferred)) return available[0];
  return preferred;
}

/** Filter records to a single source (used everywhere we have a fully-loaded scan). */
export function filterBySource<T extends { source: ProviderId }>(
  records: T[],
  source: ProviderId,
): T[] {
  return records.filter((r) => r.source === source);
}
