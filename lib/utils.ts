import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number, opts?: { maxFrac?: number }): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: opts?.maxFrac ?? 0,
  }).format(n);
}

export function formatTokensCompact(n: number, locale: 'en' | 'zh' = 'en'): string {
  if (!Number.isFinite(n)) return '0';
  if (locale === 'zh') {
    if (n >= 1e8) return (n / 1e8).toFixed(2) + '亿';
    if (n >= 1e4) return (n / 1e4).toFixed(1) + '万';
    return formatNumber(n);
  }
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return formatNumber(n);
}

export function formatUSD(n: number, opts?: { maxFrac?: number; minFrac?: number }): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts?.minFrac ?? 2,
    maximumFractionDigits: opts?.maxFrac ?? 2,
  }).format(n);
}

export function formatUSDPrecise(n: number): string {
  if (n === 0) return '$0';
  if (n < 0.01) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(n);
  }
  return formatUSD(n);
}

export function formatPct(n: number, frac = 1): string {
  if (!Number.isFinite(n)) return '0%';
  return `${(n * 100).toFixed(frac)}%`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) {
    const s = sec % 60;
    return s ? `${min}m ${s}s` : `${min}m`;
  }
  const hr = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${hr}h ${m}m` : `${hr}h`;
}

export function formatRelative(ts: string | number | Date, locale: 'en' | 'zh' = 'en'): string {
  const d = typeof ts === 'string' || typeof ts === 'number' ? new Date(ts) : ts;
  const now = Date.now();
  const diff = now - d.getTime();
  const isZh = locale === 'zh';
  if (diff < 0) return isZh ? '刚刚' : 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return isZh ? '刚刚' : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return isZh ? `${min} 分钟前` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isZh ? `${hr} 小时前` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return isZh ? `${day} 天前` : `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return isZh ? `${wk} 周前` : `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return isZh ? `${mo} 个月前` : `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return isZh ? `${yr} 年前` : `${yr}y ago`;
}

export function formatDateTime(ts: string | number | Date): string {
  const d = typeof ts === 'string' || typeof ts === 'number' ? new Date(ts) : ts;
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

export function projectNameFromCwd(cwd: string): string {
  if (!cwd) return '(unknown)';
  const parts = cwd.replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || cwd;
}

export function shortHash(s: string, len = 8): string {
  if (!s) return '';
  return s.replace(/-/g, '').slice(0, len);
}

export function shortenModel(model: string): string {
  if (!model) return '(unknown)';
  // strip date suffix (-20251101) and provider prefix (vertex_ai/, bedrock/, anthropic/)
  let m = model.replace(/-(\d{8})$/, '').replace(/^(vertex_ai|bedrock|anthropic)\//, '');
  // claude-opus-4-7 → opus-4-7 → Opus 4.7
  m = m.replace(/^claude-/, '');
  // split family from numeric version: "opus-4-7" → ["opus", "4", "7"]
  const parts = m.split('-');
  if (parts.length >= 2) {
    const family = parts[0];
    const version = parts.slice(1).join('.');
    return capitalize(family) + ' ' + version;
  }
  return capitalize(m.replace(/-/g, ' '));
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
