import type { AssistantRecord, CostBreakdown, Pricing, UserRecord } from '../types';

export type ProviderId = 'claude' | 'codex';

export interface ProviderCapabilities {
  hasCacheCreation: boolean;
  hasReasoningTokens: boolean;
  blockWindowMs: number;
}

export type PricingMatchType =
  | 'exact'
  | 'date-stripped'
  | 'prefix-stripped'
  | 'family-fallback'
  | 'none';

export interface PricingResolution {
  pricing: Pricing | null;
  matchType: PricingMatchType;
  matchedKey: string | null;
}

export interface ParsedFile {
  assistant: AssistantRecord[];
  user: UserRecord[];
  parentLinks: Array<[string, string | null]>;
}

export interface ProviderAdapter {
  id: ProviderId;
  displayName: { en: string; zh: string };
  shortLabel: string;
  color: { fg: string; bg: string };
  /** Path (under /public) of the provider's brand-mark image. Used by
   *  the source switcher and settings page as the primary identifier;
   *  `shortLabel` + `color` remain as fallbacks. */
  logoSrc: string;
  capabilities: ProviderCapabilities;
  /**
   * Bump this string whenever `parseFile` semantics change in a way that
   * would produce different `AssistantRecord`s for the same JSONL input
   * (token counting, field mapping, dedup keys, etc.). Persisted index
   * entries with a non-matching parserVersion are re-parsed on startup.
   * Format suggestion: `<source>-vN[-tag]`, e.g. `codex-v2-totaldelta`.
   */
  parserVersion: string;

  getDirs(): string[];
  shouldSkipDir(name: string): boolean;
  parseFile(file: string): Promise<ParsedFile>;

  resolvePricing(model: string): PricingResolution;
  shortenModel(model: string): string;
  costFromUsage(usage: AssistantRecord['usage'], pricing: Pricing | null): CostBreakdown;

  costFootnoteKey: string | null;
}
