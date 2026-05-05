import { promises as fs } from 'node:fs';
import { claudeAdapter } from './claude';
import { codexAdapter } from './codex';
import type { ProviderAdapter, ProviderId } from './types';

export type { ProviderAdapter, ProviderId, ProviderCapabilities, PricingResolution, PricingMatchType } from './types';

export const PROVIDERS: Record<ProviderId, ProviderAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
};

export const ALL_PROVIDER_IDS: ProviderId[] = ['claude', 'codex'];
export const DEFAULT_PROVIDER: ProviderId = 'claude';

export function getProvider(id: ProviderId): ProviderAdapter {
  return PROVIDERS[id];
}

export function listProviders(): ProviderAdapter[] {
  return ALL_PROVIDER_IDS.map((id) => PROVIDERS[id]);
}

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === 'string' && (v === 'claude' || v === 'codex');
}

export function coerceProviderId(v: unknown): ProviderId {
  return isProviderId(v) ? v : DEFAULT_PROVIDER;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    const s = await fs.stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function detectAvailableProviders(): Promise<ProviderId[]> {
  const out: ProviderId[] = [];
  for (const p of listProviders()) {
    for (const dir of p.getDirs()) {
      if (await dirExists(dir)) {
        out.push(p.id);
        break;
      }
    }
  }
  return out;
}
