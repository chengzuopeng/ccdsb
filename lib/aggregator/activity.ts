import type { AssistantRecord, ProviderId } from '../types';

export interface ActivityStats {
  sessions: number;
  messages: number;
  totalTokens: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
  /** 0-23, the hour of day with the most assistant records. -1 if no data. */
  peakHour: number;
  /** Most-used model (by request count). null if no data. */
  favoriteModel: string | null;
  /** 7 rows (Sun..Sat) × 24 cols (0..23). Cell = message count. */
  heatmap: number[][];
  /** Highest single cell (message count) — for normalizing the heatmap intensity. */
  heatmapMax: number;
  /** Same shape as heatmap, but cells are token sums (input+output+cR+cW). */
  tokenHeatmap: number[][];
  /** Sum of input+output+cR+cW across all included records. */
  tokensSummed: number;
}

interface Opts {
  source: ProviderId;
  /** Optional cap on how far back the streak walk looks. Defaults to 365. */
  streakWindowDays?: number;
}

const DAY_MS = 86_400_000;

export function computeActivityStats(
  records: AssistantRecord[],
  opts: Opts,
): ActivityStats {
  const filtered = records.filter((r) => r.source === opts.source);
  if (filtered.length === 0) {
    return {
      sessions: 0,
      messages: 0,
      totalTokens: 0,
      activeDays: 0,
      currentStreak: 0,
      longestStreak: 0,
      peakHour: -1,
      favoriteModel: null,
      heatmap: emptyHeatmap(),
      heatmapMax: 0,
      tokenHeatmap: emptyHeatmap(),
      tokensSummed: 0,
    };
  }

  const sessionSet = new Set<string>();
  const dayKeys = new Set<string>();
  const hourCounts = new Array<number>(24).fill(0);
  const modelCounts = new Map<string, number>();
  const heatmap = emptyHeatmap();
  const tokenHeatmap = emptyHeatmap();
  let totalTokens = 0;
  let messages = 0;

  for (const r of filtered) {
    if (r.sessionId) sessionSet.add(r.sessionId);
    const d = new Date(r.timestamp);
    if (Number.isNaN(d.getTime())) continue;
    const dayKey = localDayKey(d);
    dayKeys.add(dayKey);
    const dow = d.getDay(); // 0..6, Sun..Sat
    const hour = d.getHours(); // 0..23
    hourCounts[hour] += 1;
    heatmap[dow][hour] += 1;
    modelCounts.set(r.model, (modelCounts.get(r.model) ?? 0) + 1);
    const u = r.usage;
    const recTokens =
      u.input_tokens +
      u.output_tokens +
      u.cache_read_input_tokens +
      u.cache_creation_input_tokens;
    tokenHeatmap[dow][hour] += recTokens;
    totalTokens += recTokens;
    messages += 1;
  }

  const peakHour = argMax(hourCounts);
  const favoriteModel = pickTopKey(modelCounts);
  const { current, longest } = computeStreaks(dayKeys, opts.streakWindowDays ?? 365);

  let heatmapMax = 0;
  for (const row of heatmap) for (const v of row) if (v > heatmapMax) heatmapMax = v;

  return {
    sessions: sessionSet.size,
    messages,
    totalTokens,
    activeDays: dayKeys.size,
    currentStreak: current,
    longestStreak: longest,
    peakHour,
    favoriteModel,
    heatmap,
    heatmapMax,
    tokenHeatmap,
    tokensSummed: totalTokens,
  };
}

function emptyHeatmap(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}

function localDayKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function argMax(arr: number[]): number {
  let bestIdx = -1;
  let best = -1;
  for (let i = 0; i < arr.length; i += 1) {
    if (arr[i] > best) {
      best = arr[i];
      bestIdx = i;
    }
  }
  return bestIdx;
}

function pickTopKey(m: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = -1;
  for (const [k, v] of m) {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  }
  return best;
}

function computeStreaks(
  dayKeys: Set<string>,
  windowDays: number,
): { current: number; longest: number } {
  if (dayKeys.size === 0) return { current: 0, longest: 0 };

  // Build sorted ascending list of day timestamps (midnight).
  const days = Array.from(dayKeys)
    .map((k) => new Date(k + 'T00:00:00').getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  // Longest run of consecutive calendar days.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    if (days[i] - days[i - 1] === DAY_MS) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // Current streak: walk back from today (or yesterday if today has no
  // activity yet — preserves the streak across the not-yet-active morning).
  const todayMs = atMidnight(Date.now());
  const lastDay = days[days.length - 1];
  if (todayMs - lastDay > DAY_MS) {
    return { current: 0, longest };
  }
  let cursor = lastDay;
  let current = 0;
  let scanned = 0;
  const inSet = new Set(days);
  while (scanned < windowDays && inSet.has(cursor)) {
    current += 1;
    cursor -= DAY_MS;
    scanned += 1;
  }
  return { current, longest };
}

function atMidnight(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// --- Fun comparison: tokens vs famous works ---
//
// Source: published word counts (rough). Tokens estimated at ~1.3 tokens/word
// for English prose. Used purely as flavor text — not precise.

interface Reference {
  key: string;
  tokens: number;
}

const REFERENCES: Reference[] = [
  { key: 'haiku', tokens: 22 }, // ~17 words
  { key: 'tweet', tokens: 50 }, // ~38 words
  { key: 'littlePrince', tokens: 22_000 }, // ~17K words
  { key: 'gatsby', tokens: 65_000 }, // ~50K words
  { key: 'hobbit', tokens: 124_000 }, // ~95K words
  { key: 'lotrTrilogy', tokens: 624_000 }, // ~480K words
  { key: 'warAndPeace', tokens: 763_000 }, // ~587K words
  { key: 'harryPotterAll', tokens: 1_430_000 }, // ~1.1M words
  { key: 'encyclopediaBritannica', tokens: 57_200_000 }, // ~44M words
  { key: 'wikipediaEn', tokens: 6_500_000_000 }, // ~5B words
];

export interface TokenComparison {
  /** i18n key suffix to look up the reference name. */
  refKey: string;
  /** How many copies of the reference work the user has effectively used. */
  multiplier: number;
}

/**
 * Pick the largest reference where multiplier ≥ 5 — that's the most
 * impressive but still meaningful comparison. Falls back to the smallest
 * reference if total is tiny.
 */
export function pickTokenComparison(totalTokens: number): TokenComparison | null {
  if (totalTokens <= 0) return null;
  let chosen: Reference | null = null;
  for (const r of REFERENCES) {
    const mult = totalTokens / r.tokens;
    if (mult >= 5) chosen = r;
  }
  if (!chosen) chosen = REFERENCES[0];
  return { refKey: chosen.key, multiplier: totalTokens / chosen.tokens };
}
