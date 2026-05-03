'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';

const PRESETS = [
  { value: '1d', tk: 'range.today' },
  { value: '7d', tk: 'range.7d' },
  { value: '30d', tk: 'range.30d' },
  { value: '90d', tk: 'range.90d' },
  { value: 'all', tk: 'range.all' },
];

export function RangePicker({ defaultValue = '7d' }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const current = params.get('range') || defaultValue;

  function setRange(v: string) {
    const next = new URLSearchParams(params.toString());
    next.set('range', v);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-button border border-border bg-bg-surface p-0.5">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => setRange(p.value)}
          className={cn(
            'px-2.5 py-1 text-xs font-medium rounded transition-colors',
            current === p.value
              ? 'bg-bg-surface-hi text-text-primary'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {t(p.tk)}
        </button>
      ))}
    </div>
  );
}
