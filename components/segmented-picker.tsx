'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';

export interface SegmentedOption {
  value: string;
  tk: string;
}

interface Props {
  paramKey: string;
  defaultValue: string;
  options: SegmentedOption[];
  ariaLabel?: string;
}

export function SegmentedPicker({ paramKey, defaultValue, options, ariaLabel }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();
  const rawCurrent = params.get(paramKey) || defaultValue;
  const current = options.some((o) => o.value === rawCurrent) ? rawCurrent : defaultValue;
  const groupRef = useRef<HTMLDivElement>(null);

  function set(v: string) {
    const next = new URLSearchParams(params.toString());
    next.set(paramKey, v);
    router.push(`${pathname}?${next.toString()}`);
  }

  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const idx = options.findIndex((o) => o.value === current);
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const nextIdx = (idx + dir + options.length) % options.length;
    set(options[nextIdx].value);
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]');
    buttons?.[nextIdx]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKey}
      className="inline-flex rounded-button border border-border bg-bg-surface p-0.5"
    >
      {options.map((p) => {
        const active = current === p.value;
        return (
          <button
            key={p.value}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => set(p.value)}
            className={cn(
              'px-2.5 py-1 text-xs font-medium rounded transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              active
                ? 'bg-bg-surface-hi text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t(p.tk)}
          </button>
        );
      })}
    </div>
  );
}
