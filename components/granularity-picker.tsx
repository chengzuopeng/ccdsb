'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';

const GRANS = [
  { value: 'hour', tk: 'gran.hour' },
  { value: 'day', tk: 'gran.day' },
  { value: 'week', tk: 'gran.week' },
  { value: 'month', tk: 'gran.month' },
];

export function GranularityPicker({ defaultValue = 'day' }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const current = params.get('gran') || defaultValue;

  function set(v: string) {
    const next = new URLSearchParams(params.toString());
    next.set('gran', v);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex rounded-button border border-border bg-bg-surface p-0.5">
      {GRANS.map((p) => (
        <button
          key={p.value}
          onClick={() => set(p.value)}
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
